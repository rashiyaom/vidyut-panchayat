import type { Allocation, Bid, Report } from "../../contract/types";
import { agentIds } from "../../contract/schemas";
import { total, type Constraints } from "../protocol/clearing";
import { allocationHash } from "../protocol/messages";
export function validate(
  a: Allocation,
  bids: Bid[],
  c: Constraints,
  options: {
    reserves?: { value: number; capacity: number }[];
    hashes?: string[];
    live?: number;
    kind?: string;
  } = {},
): Report {
  const errors: string[] = [];
  const eps = 1e-7;
  if (agentIds.some((id) => !Number.isFinite(a[id]) || a[id] < 0))
    errors.push("I3: nonfinite/negative allocation");
  if (
    agentIds.some((id) => Math.abs(a[id] * 100 - Math.round(a[id] * 100)) > eps)
  )
    errors.push("I3: allocation must use 0.01 PU increments");
  if (total(a) > c.supply + eps) errors.push("I1: supply exceeded");
  for (const f of c.network.feeders) {
    const b = bids.find((b) => b.id === f.id);
    if (a[f.id] > Math.min(b?.demand ?? 0, c.feederCaps[f.id]) + eps)
      errors.push(`I3: ${f.id} demand/feeder cap`);
  }
  for (const bus of c.network.buses) {
    const flow = c.network.feeders
      .filter((f) => f.bus === bus.id)
      .reduce((s, f) => s + a[f.id], 0);
    if (flow > c.busCaps[bus.id] + eps) errors.push(`I2: ${bus.id} bus cap`);
  }
  if (
    options.reserves?.some(
      (r) =>
        !Number.isFinite(r.value) || r.value < 0 || r.value > r.capacity + eps,
    )
  )
    errors.push("I4: reserve out of bounds");
  if (
    options.kind === "commit" &&
    (!options.hashes?.length ||
      options.hashes.length !== options.live ||
      options.hashes.some((h) => h !== allocationHash(a)))
  )
    errors.push("I5: missing or inconsistent agreement");
  return { ok: !errors.length, errors };
}
