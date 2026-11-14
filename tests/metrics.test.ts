import { expect, it } from "vitest";
import { config } from "./fixtures";
import { run } from "../src/engine/world";
import { effectiveService } from "../src/engine/dependencyGraph";
import { reserveService } from "../src/engine/damage";
import { equalSplit } from "../src/engine/baselines/equalSplit";
import { optimum } from "../src/engine/baselines/optimum";
import { environment } from "../src/engine/events";
import { agentIds } from "../src/contract/schemas";
import type { Bid, AgentTick, Strategy } from "../src/contract/types";
it("uses prior service and exhausts backup without creating energy", () => {
  const hospital = config.profiles.agents.find((p) => p.id === "hospital")!;
  expect(effectiveService(hospital, 1, [])).toBe(1);
  expect(
    effectiveService(hospital, 1, [{ id: "water", service: 0 } as AgentTick]),
  ).toBe(0.5);
  const result = reserveService(hospital, 24, 0, 1 / 12, 1);
  expect(result.own).toBe(0.5);
  expect(result.reserve).toBe(0);
  expect(reserveService(hospital, 24, 0, 0, 1).own).toBe(0);
});
it("matches a brute force oracle for the linear optimum on small laminar instances", () => {
  for (let supply = 0; supply <= 6; supply++)
    for (let central = 0; central <= 4; central++) {
      const c = {
        ...environment(config, 0),
        network: config.network,
        supply,
        busCaps: { east: 2, central, west: 3 },
      };
      const ids = ["hospital", "telecom", "water"] as const,
        weights = [1, 0.8, 0.85];
      const bids: Bid[] = ids.map((id, i) => ({
        id,
        demand: 2,
        minimum: 0,
        value: weights[i],
        flexibility: 1,
        reserveHours: 0,
        bus: id === "water" ? "west" : "central",
        cap: 2,
      }));
      const a = optimum(bids, c),
        objective = ids.reduce((s, id, i) => s + a[id] * weights[i], 0);
      let best = 0;
      for (let x = 0; x <= 2; x++)
        for (let y = 0; y <= 2; y++)
          for (let z = 0; z <= 2; z++)
            if (x + y + z <= supply && x + y <= central)
              best = Math.max(best, x + 0.8 * y + 0.85 * z);
      expect(objective).toBeCloseTo(best, 7);
    }
});
it("equal water filling redistributes unused demand and honors local caps", () => {
  const c = { ...environment(config, 0), network: config.network, supply: 12 };
  const bids: Bid[] = ["hospital", "water", "telecom"].map((id, i) => ({
    id: id as Bid["id"],
    bus: id === "water" ? "west" : "central",
    demand: i === 0 ? 2 : 20,
    minimum: 0,
    value: 1,
    flexibility: 1,
    reserveHours: 0,
    cap: 40,
  }));
  const a = equalSplit(bids, c);
  expect(a.hospital).toBe(2);
  expect(a.water).toBe(5);
  expect(a.telecom).toBe(5);
});
it("all four strategies yield complete records and comparable metrics", () => {
  for (const strategy of [
    "council",
    "static",
    "equal",
    "optimum",
  ] as Strategy[]) {
    const ticks = run({ ...config, strategy });
    expect(ticks.length).toBe(144);
    expect(ticks[143].metrics.phl).toBeGreaterThan(0);
    expect(ticks.every((t) => t.constitution.ok)).toBe(true);
  }
});
it("200 seeds across all four strategies satisfy I1–I4 at every applied tick", () => {
  for (let seed = 0; seed < 200; seed++)
    for (const strategy of [
      "council",
      "static",
      "equal",
      "optimum",
    ] as Strategy[]) {
      const c = {
        ...config,
        seed,
        strategy,
        scenario: { ...config.scenario, dropRate: 0.01, timingJitter: 3 },
      };
      const ticks = run(c);
      for (const tick of ticks) {
        expect(
          tick.agents.reduce((s, a) => s + a.allocated, 0),
        ).toBeLessThanOrEqual(tick.supply + 1e-7);
        expect(tick.lines.every((l) => l.flow <= l.capacity + 1e-7)).toBe(true);
        expect(
          tick.agents.every(
            (a) =>
              a.allocated >= 0 &&
              a.allocated <= a.demand + 1e-7 &&
              a.reserveHours >= 0 &&
              a.reserveHours <= a.reserveCapacity,
          ),
        ).toBe(true);
        expect(tick.metrics.violations).toBe(0);
        expect(tick.agents.map((a) => a.id)).toEqual([...agentIds]);
      }
      if (seed % 25 === 0)
        expect(JSON.stringify(ticks)).toBe(JSON.stringify(run(c)));
    }
}, 120000);
