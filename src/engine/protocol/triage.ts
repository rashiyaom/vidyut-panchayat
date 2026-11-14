import type { Bid } from "../../contract/types";
import { emptyAllocation, project, type Constraints } from "./clearing";
export function triage(bids: Bid[], c: Constraints) {
  const requested = emptyAllocation();
  for (const b of bids)
    requested[b.id] = Math.min(b.minimum, b.demand, c.feederCaps[b.id]);
  const minimums = project(requested, bids, c);
  return {
    minimums,
    shed: bids
      .filter((b) => minimums[b.id] + 1e-8 < b.minimum)
      .map((b) => b.id),
  };
}
