import type { Bid } from "../../contract/types";
import {
  emptyAllocation,
  residual,
  type Constraints,
} from "../protocol/clearing";
import { quantize } from "../rng";
export function equalSplit(bids: Bid[], c: Constraints) {
  const a = emptyAllocation();
  let active = bids.slice();
  for (let round = 0; round < 32 && active.length; round++) {
    const left = residual(c, a);
    const share = Math.min(
      left.supply / active.length,
      ...active.map((b) =>
        Math.min(
          b.demand - a[b.id],
          left.feederCaps[b.id],
          left.busCaps[b.bus] / active.filter((x) => x.bus === b.bus).length,
        ),
      ),
    );
    if (share < 0.01) break;
    for (const b of active) a[b.id] = quantize(a[b.id] + share);
    const next = residual(c, a);
    active = active.filter(
      (b) =>
        b.demand - a[b.id] >= 0.01 &&
        next.feederCaps[b.id] >= 0.01 &&
        next.busCaps[b.bus] >= 0.01,
    );
  }
  return a;
}
