import type { Bid } from "../../contract/types";
export function concession(b: Bid, price: number) {
  return (
    b.minimum +
    (b.demand - b.minimum) *
      (price <= b.value
        ? 1
        : Math.min(1, (b.value / price) ** (1 + 2 * b.flexibility)))
  );
}
