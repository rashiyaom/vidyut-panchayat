import type { Profile } from "../contract/types";
import { DT } from "./clock";
export const harm = (p: Profile, service: number) =>
  p.weight * (1 - service) ** 1.5 * DT;
export function reserveService(
  p: Profile,
  demand: number,
  allocation: number,
  reserve: number,
  fuelService: number,
) {
  const grid = demand > 0 ? Math.min(1, allocation / demand) : 1,
    deficit = 1 - grid;
  const backup = p.reserve
    ? Math.min(deficit, p.reserve.coverage, reserve / DT)
    : 0;
  let remaining = Math.max(0, reserve - backup * DT);
  if (
    p.reserve &&
    grid >= 0.95 &&
    (p.reserve.kind !== "diesel" || fuelService >= 0.5)
  )
    remaining = Math.min(
      p.reserve.hours,
      remaining + p.reserve.refillPerHour * DT,
    );
  return { own: Math.min(1, grid + backup), backup, reserve: remaining };
}
