import type { Bid, Network, Plan, Report } from "../../contract/types";
import { planSchema } from "../../contract/schemas";
import { validate } from "./invariants";
import { planHash } from "../planning/planDocument";
import type { World } from "../world";
import { environment } from "../events";
export function validatePlan(
  plan: Plan,
  network: Network,
  source?: World,
): Report {
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) return { ok: false, errors: ["I8: malformed plan"] };
  const errors: string[] = [];
  if (plan.hash !== planHash(plan)) errors.push("I8: plan hash changed");
  let next = plan.startTick;
  for (const block of plan.blocks) {
    if (block.fromTick !== next || block.toTick - block.fromTick > 2)
      errors.push("I8: schedule gap/overlap/block size");
    next = block.toTick + 1;
  }
  if (next !== plan.startTick + plan.horizonTicks)
    errors.push("I8: incomplete horizon");
  for (const block of [
    ...plan.blocks,
    ...plan.contingencies.flatMap((c) => c.blocks),
  ]) {
    if (source) {
      const envs = Array.from(
        { length: block.toTick - block.fromTick + 1 },
        (_, i) =>
          environment(source.config, block.fromTick + i, source.injected),
      );
      if (block.supply > Math.min(...envs.map((e) => e.supply)) * (source.planSupplyFraction ?? 0.85) + 1e-7)
        errors.push("I8: optimistic supply envelope");
      for (const bus of network.buses)
        if (
          block.busCaps[bus.id] >
          Math.min(...envs.map((e) => e.busCaps[bus.id])) + 1e-7
        )
          errors.push("I8: optimistic bus envelope");
      for (const f of network.feeders) {
        if (
          block.feederCaps[f.id] >
          Math.min(...envs.map((e) => e.feederCaps[f.id])) + 1e-7
        )
          errors.push("I8: optimistic feeder envelope");
        const profile = source.config.profiles.agents.find(
          (p) => p.id === f.id,
        )!;
        if (block.demands[f.id] >
            (source.forecastDemand?.[block.fromTick]?.[f.id] ??
              profile.demand * Math.min(...envs.map((e) => e.multipliers[f.id])) * 0.9) + 1e-7)
          errors.push("I8: optimistic demand envelope");
      }
    }
    const bids: Bid[] = network.feeders.map((f) => ({
      id: f.id,
      demand: block.demands[f.id],
      minimum: 0,
      value: 1,
      flexibility: 1,
      reserveHours: 0,
      bus: f.bus,
      cap: block.feederCaps[f.id],
    }));
    const r = validate(block.allocations, bids, {
      supply: block.supply,
      busCaps: block.busCaps,
      feederCaps: block.feederCaps,
      network,
    });
    errors.push(...r.errors.map((e) => `I8 block ${block.fromTick}: ${e}`));
  }
  return { ok: !errors.length, errors };
}
