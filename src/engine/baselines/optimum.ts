import type { Allocation, Bid } from "../../contract/types";
import {
  emptyAllocation,
  residual,
  type Constraints,
} from "../protocol/clearing";
import { quantize } from "../rng";
// Linear objective sum W_i * a_i on a laminar capacity tree; greedy is exact.
export function optimum(bids: Bid[], c: Constraints): Allocation {
  const a = emptyAllocation();
  for (const b of bids
    .slice()
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))) {
    const left = residual(c, a);
    a[b.id] = quantize(
      Math.min(
        b.demand,
        left.supply,
        left.busCaps[b.bus],
        left.feederCaps[b.id],
      ),
    );
  }
  return a;
}
