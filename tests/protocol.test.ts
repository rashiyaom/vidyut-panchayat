import { expect, it } from "vitest";
import { config } from "./fixtures";
import { initialWorld, run, step } from "../src/engine/world";
import { clear, bisect } from "../src/engine/protocol/clearing";
import { concession } from "../src/engine/agents/concession";
import { environment } from "../src/engine/events";
import { validate } from "../src/engine/constitution/invariants";
import type { Bid } from "../src/contract/types";
const bids: Bid[] = config.profiles.agents.map((p) => ({
  id: p.id,
  demand: p.demand,
  minimum: p.minViable,
  value: p.weight * 3,
  flexibility: p.flexibility,
  reserveHours: 0,
  bus: config.network.feeders.find((f) => f.id === p.id)!.bus,
  cap: 100,
}));
it("concessions are monotone and bounded; search takes feasible side in <=8 rounds", () => {
  for (const b of bids) {
    let last = b.demand;
    for (let price = 0; price < 100; price += 0.1) {
      const a = concession(b, price);
      expect(a).toBeLessThanOrEqual(last + 1e-8);
      expect(a).toBeGreaterThanOrEqual(b.minimum);
      last = a;
    }
  }
  const search = bisect(10, (p) => 100 / (1 + p));
  expect(search.rounds.length).toBeLessThanOrEqual(8);
  expect(100 / (1 + search.price)).toBeLessThanOrEqual(10);
});
it("triages at 55 PU and Central failure, satisfying all line constraints", () => {
  const c = { ...environment(config, 54), network: config.network };
  const result = clear(bids, c);
  expect(result.triage.length).toBeGreaterThan(0);
  expect(validate(result.allocation, bids, c).ok).toBe(true);
});
it("commits unanimous views and aborts twice on injected dropped bids before safe fallback", () => {
  let w = initialWorld(config);
  let r = step(w);
  expect(r.tick.negotiation.outcome).toBe("commit");
  w = r.world;
  w.injected.push({ type: "drop", tick: 1, label: "Test dropped BID" });
  r = step(w);
  expect(r.tick.negotiation.aborts).toBe(2);
  expect(r.tick.negotiation.fallback).toBe(true);
  expect(r.tick.constitution.ok).toBe(true);
  expect(r.tick.negotiation.messages.some((m) => !m.delivered)).toBe(true);
});
it("holds a crashed allocation, detects two missed heartbeats and rejoins", () => {
  const ticks = run(
    { ...config, scenario: { ...config.scenario, demandNoise: 0 } },
    112,
  );
  const telecom = (t: number) =>
    ticks[t].agents.find((a) => a.id === "telecom")!;
  expect(telecom(108).allocated).toBe(telecom(107).allocated);
  expect(telecom(108).isDown).toBe(false);
  expect(telecom(109).isDown).toBe(true);
  expect(telecom(111).isDown).toBe(false);
});
it("rejects an illegal scheduled proposal before applying the safe projection", () => {
  let w = initialWorld(config);
  w = step(w).world;
  const allocation = Object.fromEntries(
    config.profiles.agents.map((p) => [p.id, 1000]),
  );
  const plan = {
    blocks: [
      {
        fromTick: 1,
        toTick: 3,
        allocations: allocation,
        supply: 170,
        busCaps: { east: 90, central: 80, west: 100 },
      },
    ],
  } as unknown as import("../src/contract/types").Plan;
  const result = step(w, plan);
  expect(result.tick.negotiation.blocked).toBe(2);
  expect(result.tick.negotiation.fallback).toBe(true);
  expect(result.tick.metrics.violations).toBe(0);
  expect(result.tick.constitution.ok).toBe(true);
});
it("disabled loads draw first and remain feasible under simultaneous bus and supply shortage", () => {
  const c = structuredClone(config);
  c.enabledAgents = [];
  c.scenario.initialSupply = 20;
  c.scenario.events = [];
  c.network.buses.find((b) => b.id === "central")!.capacity = 5;
  const t = step(initialWorld(c)).tick;
  expect(t.agents.every((a) => !a.enabled)).toBe(true);
  expect(t.agents.reduce((s, a) => s + a.allocated, 0)).toBeLessThanOrEqual(20);
  expect(t.lines.find((l) => l.id === "bus-central")!.flow).toBeLessThanOrEqual(
    5,
  );
  expect(t.constitution.ok).toBe(true);
});
it("late bid deliveries are excluded at the deterministic barrier", async () => {
  const { MessageBus } = await import("../src/engine/protocol/bus");
  const { message } = await import("../src/engine/protocol/messages");
  const bus = new MessageBus(42, 0, false, "water");
  expect(
    bus.send(
      message({
        type: "BID",
        sender: "water",
        recipient: "hospital",
        tick: 1,
        round: 0,
        attempt: 0,
        reason: "Late bid",
        bid: bids.find((b) => b.id === "water")!,
      }),
    ),
  ).toBe(false);
  expect(bus.trace[0].reason).toContain("barrier");
});
it("each actor clears its own inbox and preapproved plans do not bypass missing bids", async () => {
  const { UtilityAgent } = await import("../src/engine/agents/baseAgent");
  const c = { ...environment(config, 12), network: config.network },
    world = initialWorld(config);
  const actor = new UtilityAgent(
    config.profiles.agents.find((p) => p.id === "hospital")!,
    world.states.hospital,
  );
  actor.receive(bids.find((b) => b.id === "hospital")!);
  const local = actor.candidate(c).allocation;
  expect(local.water).toBe(0);
  expect(local.hospital).toBeGreaterThan(0);
  const complete = clear(bids, c).allocation;
  const missingView = actor.plannedCandidate(
    complete,
    Object.fromEntries(
      config.profiles.agents.map((p) => [p.id, 0]),
    ) as import("../src/contract/types").Allocation,
  );
  expect(missingView.water).toBe(0);
  expect(complete.water).toBeGreaterThan(0);
});
it("counter traces record the actual local and root search bounds", () => {
  const w = initialWorld({
    ...config,
    scenario: {
      ...config.scenario,
      initialSupply: 110,
      events: [],
      demandNoise: 0,
    },
  });
  const t = step(w).tick;
  const bids = t.negotiation.messages
    .filter((m) => m.type === "BID" && m.recipient === "hospital")
    .map((m) => m.bid!);
  const cleared = clear(bids, {
    ...environment(w.config, 0),
    network: config.network,
  });
  const counters = t.negotiation.messages.filter(
    (m) => m.sender === "hospital" && m.phase === "root",
  );
  expect(counters.map((m) => m.price)).toEqual(
    cleared.rounds.map((p) => Math.max(p, cleared.localPrices.central)),
  );
  expect(t.negotiation.messages.some((m) => m.phase === "bus")).toBe(true);
});
