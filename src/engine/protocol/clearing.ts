import type { Allocation, Bid, BusId, Network } from "../../contract/types";
import { agentIds } from "../../contract/schemas";
import { quantize } from "../rng";
import { concession } from "../agents/concession";
import { triage } from "./triage";
export const emptyAllocation = (): Allocation =>
  Object.fromEntries(agentIds.map((id) => [id, 0])) as Allocation;
export interface Constraints {
  supply: number;
  busCaps: Record<BusId, number>;
  feederCaps: Allocation;
  network: Network;
}
export const total = (a: Allocation) =>
  agentIds.reduce((s, id) => s + a[id], 0);
export function project(
  input: Allocation,
  bids: Bid[],
  c: Constraints,
  proportional = false,
): Allocation {
  const a = emptyAllocation();
  for (const b of bids)
    a[b.id] = quantize(
      Math.max(0, Math.min(input[b.id], b.demand, c.feederCaps[b.id])),
    );
  const trim = (ids: (typeof agentIds)[number][], cap: number) => {
    const sum = ids.reduce((s, id) => s + a[id], 0);
    if (sum <= cap + 1e-9) return;
    if (proportional) {
      ids.forEach((id) => (a[id] = quantize((a[id] * cap) / sum)));
      return;
    }
    let excess = sum - cap;
    const order = bids
      .filter((b) => ids.includes(b.id))
      .sort((x, y) => x.value - y.value || x.id.localeCompare(y.id));
    for (const b of order) {
      const cut = Math.min(a[b.id], excess);
      a[b.id] = quantize(a[b.id] - cut);
      excess -= cut;
      if (excess <= 1e-9) break;
    }
  };
  for (const bus of c.network.buses)
    trim(
      c.network.feeders.filter((f) => f.bus === bus.id).map((f) => f.id),
      c.busCaps[bus.id],
    );
  trim([...agentIds], c.supply);
  return a;
}
export function residual(c: Constraints, fixed: Allocation): Constraints {
  return {
    ...c,
    supply: Math.max(0, c.supply - total(fixed)),
    busCaps: Object.fromEntries(
      c.network.buses.map((b) => [
        b.id,
        Math.max(
          0,
          c.busCaps[b.id] -
            c.network.feeders
              .filter((f) => f.bus === b.id)
              .reduce((s, f) => s + fixed[f.id], 0),
        ),
      ]),
    ) as Record<BusId, number>,
    feederCaps: Object.fromEntries(
      agentIds.map((id) => [id, Math.max(0, c.feederCaps[id] - fixed[id])]),
    ) as Allocation,
  };
}
export function bisect(cap: number, load: (p: number) => number) {
  if (load(0) <= cap + 1e-9) return { price: 0, rounds: [0] };
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 40 && load(hi) > cap + 1e-9; i++) hi *= 2;
  const rounds: number[] = [];
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (load(mid) > cap + 1e-9) lo = mid;
    else hi = mid;
    rounds.push(hi);
  }
  return { price: hi, rounds };
}
export function clear(bids: Bid[], c: Constraints) {
  const ordered = bids.slice().sort((a, b) => a.id.localeCompare(b.id));
  const { minimums, shed } = triage(ordered, c);
  const adjusted = ordered.map((b) => ({
    ...b,
    minimum: minimums[b.id],
    demand: Math.min(b.demand, c.feederCaps[b.id]),
  }));
  const prices = { east: 0, central: 0, west: 0 };
  const busRounds: Record<BusId, number[]> = {
    east: [],
    central: [],
    west: [],
  };
  for (const bus of c.network.buses) {
    const local = adjusted.filter((b) => b.bus === bus.id);
    const search = bisect(c.busCaps[bus.id], (p) =>
      local.reduce((s, b) => s + concession(b, p), 0),
    );
    prices[bus.id] = search.price;
    busRounds[bus.id] = search.rounds;
  }
  const root = bisect(c.supply, (p) =>
    adjusted.reduce((s, b) => s + concession(b, Math.max(p, prices[b.bus])), 0),
  );
  const allocation = emptyAllocation();
  for (const b of adjusted)
    allocation[b.id] = quantize(
      concession(b, Math.max(root.price, prices[b.bus])),
    );
  // Floating-point tails at an exactly saturated minimum are projected downward only.
  const feasible = project(allocation, ordered, c);
  return {
    allocation: feasible,
    prices: Object.fromEntries(
      Object.entries(prices).map(([b, p]) => [b, Math.max(p, root.price)]),
    ) as Record<BusId, number>,
    rounds: root.rounds,
    busRounds,
    localPrices: prices,
    triage: shed,
    adjusted,
  };
}
