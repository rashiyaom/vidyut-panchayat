import type { AgentTick, Profile } from "../../contract/types";
export function rotation(p: Profile, starved: number, previous: AgentTick[]) {
  return p.tier === 3 &&
    starved > 12 &&
    previous.some((a) => a.tier === 3 && a.service > 0.8)
    ? 1.5
    : 1;
}
