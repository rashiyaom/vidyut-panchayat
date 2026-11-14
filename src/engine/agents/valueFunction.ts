import type { Profile } from "../../contract/types";
export function valueFunction(
  p: Profile,
  reserve: number,
  stress: number,
  bias = 1,
) {
  return (
    p.weight *
    (1 + 2 * (1 - Math.min(reserve, 4) / 4)) *
    (1 + 0.5 * stress) *
    bias
  );
}
