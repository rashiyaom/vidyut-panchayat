import type { Allocation, Bid } from "../../contract/types";
import { agentIds } from "../../contract/schemas";
import { optimum } from "../baselines/optimum";
import { project, type Constraints } from "../protocol/clearing";
import { quantize } from "../rng";

/** A bounded priority compromise proposed in the plan and reapproved by agents. */
export function priorityBlend(
  negotiated: Allocation,
  bids: Bid[],
  constraints: Constraints,
  fixedWeights: Allocation,
  fraction: number,
): Allocation {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    throw new Error("Priority blend fraction must be between 0 and 1");
  if (fraction === 0) return negotiated;
  const priority = optimum(bids.map((bid) => ({ ...bid, value: fixedWeights[bid.id] })), constraints);
  const compromise = Object.fromEntries(agentIds.map((id) => [
    id, quantize((1 - fraction) * negotiated[id] + fraction * priority[id]),
  ])) as Allocation;
  return project(compromise, bids, constraints);
}
