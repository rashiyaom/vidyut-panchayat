import type {
  AgentId,
  AgentTick,
  Allocation,
  Bid,
  Config,
  Plan,
  ScenarioEvent,
  Tick,
  Trace,
} from "../contract/types";
import { agentIds, configSchema } from "../contract/schemas";
import { environment } from "./events";
import { rng, quantize } from "./rng";
import { hour } from "./clock";
import { UtilityAgent, type PrivateState } from "./agents/baseAgent";
import { dependencyStress, effectiveService } from "./dependencyGraph";
import { reserveService, harm } from "./damage";
import { rotation } from "./policy/rotation";
import {
  emptyAllocation,
  project,
  residual,
  type Constraints,
} from "./protocol/clearing";
import { negotiate } from "./protocol/negotiation";
import { allocationHash } from "./protocol/messages";
import { validate } from "./constitution/invariants";
import { optimum } from "./baselines/optimum";
import { equalSplit } from "./baselines/equalSplit";
import { staticPriority } from "./baselines/staticPriority";
import { score } from "./metrics/scoring";
export interface World {
  config: Config;
  t: number;
  states: Record<AgentId, PrivateState>;
  previous: Tick | null;
  injected: ScenarioEvent[];
  /** Optional historical replay, in power units. Actuals are never read by planning. */
  observedDemand?: Partial<Record<number, Allocation>>;
  /** Forecast snapshot issued at the current decision point, in power units. */
  forecastDemand?: Partial<Record<number, Allocation>>;
  /** Replay-only policy experiment; the normal plan keeps its 85% reserve. */
  planSupplyFraction?: number;
  replayEndTick?: number;
}
export function initialWorld(input: Config): World {
  const config = configSchema.parse(input);
  config.profiles.agents.sort((a, b) => a.id.localeCompare(b.id));
  return {
    config,
    t: 0,
    states: Object.fromEntries(
      config.profiles.agents.map((p) => [
        p.id,
        {
          reserve: p.reserve?.hours ?? 0,
          stress: 0,
          lastBid: null,
          lastCommitted: 0,
          starved: 0,
          missed: 0,
          reserveAlarm: (p.reserve?.hours ?? 0) < 1,
        },
      ]),
    ) as World["states"],
    previous: null,
    injected: [],
  };
}
export function step(input: World, plan?: Plan): { world: World; tick: Tick } {
  if (input.t >= 144) throw new Error("Scenario complete");
  const world: World = { ...input, states: structuredClone(input.states) },
    { config, t } = world,
    env = environment(config, t, world.injected),
    random = rng(config.seed ^ Math.imul(t + 1, 997));
  const c: Constraints = { ...env, network: config.network },
    previous = world.previous?.agents ?? [],
    actors: UtilityAgent[] = [],
    bids: Bid[] = [];
  for (const p of config.profiles.agents) {
    const state = world.states[p.id];
    state.stress = dependencyStress(p, previous);
    state.missed = env.crashed.includes(p.id) ? state.missed + 1 : 0;
    const actor = new UtilityAgent(p, state),
      demand = quantize(world.observedDemand?.[t]?.[p.id] ?? (
        p.demand *
          env.multipliers[p.id] *
          (1 + (random() * 2 - 1) * config.scenario.demandNoise)
      ));
    bids.push(actor.observe(demand, c, rotation(p, state.starved, previous)));
    actors.push(actor);
  }
  const unmanaged = bids.filter((b) => !config.enabledAgents.includes(b.id)),
    unmanagedDraw = emptyAllocation();
  for (const b of unmanaged) unmanagedDraw[b.id] = b.demand;
  const fixed = project(unmanagedDraw, unmanaged, c, true),
    afterUnmanaged = residual(c, fixed),
    crashed = bids.filter(
      (b) => config.enabledAgents.includes(b.id) && env.crashed.includes(b.id),
    ),
    hold = emptyAllocation();
  for (const b of crashed) hold[b.id] = world.states[b.id].lastCommitted;
  const safeHold = project(hold, crashed, afterUnmanaged);
  for (const id of agentIds) fixed[id] += safeHold[id];
  const available = residual(c, fixed),
    live = actors.filter(
      (a) =>
        config.enabledAgents.includes(a.profile.id) &&
        !env.crashed.includes(a.profile.id),
    ),
    liveBids = bids.filter((b) => live.some((a) => a.profile.id === b.id));
  const previousAllocation = Object.fromEntries(
    agentIds.map((id) => [id, world.states[id].lastCommitted]),
  ) as Allocation;
  let allocation: Allocation, trace: Trace;
  if (config.strategy === "council") {
    const block = plan?.blocks.find((b) => t >= b.fromTick && t <= b.toTick);
    const trigger =
      block &&
      (env.forceDrop ||
        config.enabledAgents.length < 10 ||
        Math.abs(env.supply - block.supply / (world.planSupplyFraction ?? 0.85)) /
          Math.max(1, block.supply / (world.planSupplyFraction ?? 0.85)) >
          0.15 ||
        env.crashed.length > 0 ||
        env.events.length > 0 ||
        config.network.feeders.some(
          (f) =>
            block.feederCaps && env.feederCaps[f.id] < block.feederCaps[f.id],
        ) ||
        config.network.buses.some(
          (b) => env.busCaps[b.id] < block.busCaps[b.id],
        ) ||
        bids.some(
          (b) => b.reserveHours < 1 && !world.states[b.id].reserveAlarm,
        ));
    // Historical replay caps scheduled allocations at observed demand and
    // current line limits. Normal execution retains strict plan validation.
    const planned = block && !trigger
      ? world.observedDemand
        ? project(block.allocations, bids, c)
        : block.allocations
      : undefined;
    ({ allocation, trace } = negotiate(
      live,
      liveBids,
      bids,
      available,
      c,
      fixed,
      previousAllocation,
      t,
      config.seed,
      config.scenario.dropRate,
      env.forceDrop,
      planned,
    ));
  } else {
    const weighted = liveBids.map((b) => ({
      ...b,
      value: config.profiles.agents.find((p) => p.id === b.id)!.weight,
    }));
    const fn =
      config.strategy === "equal"
        ? equalSplit
        : config.strategy === "static"
          ? staticPriority
          : optimum;
    const free = fn(weighted, available);
    allocation = emptyAllocation();
    for (const id of agentIds) allocation[id] = fixed[id] + free[id];
    trace = {
      messages: [],
      rounds: 0,
      aborts: 0,
      fallback: false,
      triage: [],
      prices: { east: 0, central: 0, west: 0 },
      hash: allocationHash(allocation),
      outcome: "baseline",
      blocked: 0,
    };
  }
  let report = validate(allocation, bids, c);
  if (!report.ok)
    throw new Error(`Unsafe engine result: ${report.errors.join(", ")}`);
  const agents: AgentTick[] = config.profiles.agents.map((p) => {
    const state = world.states[p.id],
      demand = bids.find((b) => b.id === p.id)!.demand;
    const r = reserveService(
      p,
      demand,
      allocation[p.id],
      state.reserve,
      env.flooded ? 0 : (previous.find((a) => a.id === "fuel")?.service ?? 1),
    );
    const own = p.id === "fuel" && env.flooded ? 0 : r.own,
      service = Math.max(0, Math.min(1, effectiveService(p, own, previous)));
    state.reserveAlarm = state.reserve < 1;
    state.reserve = r.reserve;
    state.lastCommitted = allocation[p.id];
    state.starved = service < 0.5 ? state.starved + 1 : 0;
    return {
      id: p.id,
      demand,
      allocated: allocation[p.id],
      reserveHours: state.reserve,
      reserveCapacity: p.reserve?.hours ?? 0,
      ownService: own,
      service,
      backup: r.backup,
      dependencyStress: state.stress,
      status:
        service < 0.01
          ? "down"
          : service < 0.5
            ? "critical"
            : service < 0.9
              ? "rationed"
              : "ok",
      isDown: state.missed >= 2,
      missedHeartbeats: state.missed,
      enabled: config.enabledAgents.includes(p.id),
      harm: harm(p, service),
      exposure: p.exposure,
      tier: p.tier,
      weight: p.weight,
    };
  });
  report = validate(allocation, bids, c, {
    reserves: agents.map((a) => ({
      value: a.reserveHours,
      capacity: a.reserveCapacity,
    })),
  });
  if (!report.ok) throw new Error(report.errors.join(";"));
  const lines = [
    ...config.network.buses.map((b) => ({
      id: `bus-${b.id}`,
      from: "substation",
      to: b.id,
      flow: config.network.feeders
        .filter((f) => f.bus === b.id)
        .reduce((s, f) => s + allocation[f.id], 0),
      capacity: env.busCaps[b.id],
      price: trace.prices[b.id],
    })),
    ...config.network.feeders.map((f) => ({
      id: `feeder-${f.id}`,
      from: f.bus,
      to: f.id,
      flow: allocation[f.id],
      capacity: env.feederCaps[f.id],
      price: trace.prices[f.bus],
    })),
  ];
  const tick: Tick = {
    version: 1,
    t,
    hour: hour(t),
    seed: config.seed,
    scenario: config.scenario.id,
    strategy: config.strategy,
    supply: env.supply,
    events: env.events,
    agents,
    lines,
    negotiation: trace,
    metrics: score(agents, trace, world.previous?.metrics, t + 1),
    constitution: report,
  };
  world.t++;
  world.previous = tick;
  return { world, tick };
}
export function run(config: Config, count = 144): Tick[] {
  let world = initialWorld(config);
  return Array.from({ length: count }, () => {
    const result = step(world);
    world = result.world;
    return result.tick;
  });
}
