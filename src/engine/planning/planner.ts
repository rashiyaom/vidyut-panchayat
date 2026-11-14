import type {
  Allocation,
  Bid,
  BusId,
  Plan,
  PlanBlock,
} from "../../contract/types";
import { agentIds } from "../../contract/schemas";
import { environment } from "../events";
import { UtilityAgent } from "../agents/baseAgent";
import { negotiate } from "../protocol/negotiation";
import {
  emptyAllocation,
  project,
  residual,
  type Constraints,
} from "../protocol/clearing";
import { quantize } from "../rng";
import { step, type World } from "../world";
import { planDocument, planHash } from "./planDocument";
import { validatePlan } from "../constitution/planValidator";
import { topUpPlan } from "./topUp";
import { priorityBlend } from "./priorityBlend";
export function createPlan(
  source: World,
  horizonTicks = 18,
  revision = 0,
  note = "",
): Plan {
  if (source.t >= 144) throw new Error("Scenario complete");
  const supplyFraction = source.planSupplyFraction ?? 0.85;
  if (supplyFraction < 0.85 || supplyFraction > 1 || !Number.isFinite(supplyFraction))
    throw new Error("Plan supply fraction must be between 0.85 and 1");
  let future = structuredClone(source);
  // Roll planning state forward using forecasts; held-out actuals remain private
  // to execution and evaluation.
  future.observedDemand = source.forecastDemand;
  future.config.scenario.demandNoise = 0;
  future.config.scenario.dropRate = 0;
  const horizon = Math.min(horizonTicks, 144 - source.t),
    blocks: PlanBlock[] = [];
  for (let from = source.t; from < source.t + horizon; from += 3) {
    const to = Math.min(from + 2, source.t + horizon - 1),
      envs = Array.from({ length: to - from + 1 }, (_, i) =>
        environment(future.config, from + i, future.injected),
      );
    const busCaps = Object.fromEntries(
      future.config.network.buses.map((b) => [
        b.id,
        Math.min(...envs.map((e) => e.busCaps[b.id])),
      ]),
    ) as Record<BusId, number>;
    const feederCaps = Object.fromEntries(
      agentIds.map((id) => [
        id,
        Math.min(...envs.map((e) => e.feederCaps[id])),
      ]),
    ) as Allocation;
    const supply = quantize(Math.min(...envs.map((e) => e.supply)) * supplyFraction),
      c: Constraints = {
        supply,
        busCaps,
        feederCaps,
        network: future.config.network,
      };
    const actors = future.config.profiles.agents.map(
      (p) => new UtilityAgent(p, structuredClone(future.states[p.id])),
    );
    const bids = actors.map((a) =>
      a.observe(
        quantize(source.forecastDemand?.[from]?.[a.profile.id] ?? (
          a.profile.demand *
            Math.min(...envs.map((e) => e.multipliers[a.profile.id])) *
            0.9
        )),
        c,
        1,
      ),
    );
    const unmanaged = bids.filter(
        (b) => !future.config.enabledAgents.includes(b.id),
      ),
      draw = emptyAllocation();
    for (const b of unmanaged) draw[b.id] = b.demand;
    const fixed = project(draw, unmanaged, c, true),
      live = actors.filter((a) =>
        future.config.enabledAgents.includes(a.profile.id),
      );
    const result = negotiate(
      live,
      bids.filter((b) => future.config.enabledAgents.includes(b.id)),
      bids,
      residual(c, fixed),
      c,
      fixed,
      emptyAllocation(),
      from,
      future.config.seed,
      0,
    );
    const toppedUp = topUpPlan(result.allocation, bids, c, source.planFillFraction ?? 0);
    const fixedWeights = Object.fromEntries(source.config.profiles.agents.map((p) => [p.id, p.weight])) as Allocation;
    const block: PlanBlock = {
      fromTick: from,
      toTick: to,
      allocations: priorityBlend(toppedUp, bids, c, fixedWeights, source.planPriorityBlend ?? 0),
      supply,
      busCaps,
      feederCaps,
      demands: Object.fromEntries(
        bids.map((b) => [b.id, b.demand]),
      ) as Allocation,
    };
    blocks.push(block);
    const partial = { blocks: [block] } as Plan;
    for (let t = from; t <= to; t++) future = step(future, partial).world;
  }
  const branches = blocks.map((b) => {
    const c = {
      supply: quantize(b.supply * 0.5),
      busCaps: b.busCaps,
      feederCaps: b.feederCaps,
      network: source.config.network,
    };
    const bids: Bid[] = source.config.profiles.agents.map((p) => ({
      id: p.id,
      demand: b.demands[p.id],
      minimum: p.minViable,
      value: p.weight,
      flexibility: p.flexibility,
      reserveHours: 0,
      bus: c.network.feeders.find((f) => f.id === p.id)!.bus,
      cap: b.feederCaps[p.id],
    }));
    return {
      ...b,
      supply: c.supply,
      allocations: project(b.allocations, bids, c),
    };
  });
  const plan: Plan = {
    version: 1,
    id: "",
    hash: "",
    revision,
    startTick: source.t,
    horizonTicks: horizon,
    blocks,
    contingencies: [
      {
        trigger:
          "Supply deviation >15%, feeder loss, crash, or backup <1h: immediate local negotiation; persistent drift replans. Half-supply emergency branch shown.",
        action: "renegotiate",
        blocks: branches,
      },
    ],
    constitution: { ok: true, errors: [] },
    document: "",
    note,
  };
  plan.hash = planHash(plan);
  plan.id = `P-${source.t}-${revision}-${plan.hash}`;
  plan.constitution = validatePlan(plan, source.config.network, source);
  plan.document = planDocument(plan, supplyFraction);
  return plan;
}
