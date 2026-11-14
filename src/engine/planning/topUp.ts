import type { Allocation, Bid } from "../../contract/types";
import { agentIds } from "../../contract/schemas";
import { optimum } from "../baselines/optimum";
import { project, residual, type Constraints } from "../protocol/clearing";
import { quantize } from "../rng";

/** Preserve a negotiated floor, then offer a bounded share of feasible headroom. */
export function topUpPlan(floor: Allocation, bids: Bid[], constraints: Constraints, fraction: number): Allocation {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    throw new Error("Top-up fraction must be between 0 and 1");
  if (fraction === 0) return floor;
  const gapBids = bids.map((bid) => ({ ...bid, demand: Math.max(0, bid.demand - floor[bid.id]) }));
  const headroom = residual(constraints, floor);
  const extra = optimum(gapBids, { ...headroom, supply: quantize(headroom.supply * fraction) });
  const offered = Object.fromEntries(agentIds.map((id) => [id, quantize(floor[id] + extra[id])])) as Allocation;
  return project(offered, bids, constraints);
}
