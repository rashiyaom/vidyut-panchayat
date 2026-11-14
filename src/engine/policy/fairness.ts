import type { AgentTick } from "../../contract/types";
export function jain(values: number[]) {
  const sum = values.reduce((a, b) => a + b, 0),
    sq = values.reduce((a, b) => a + b * b, 0);
  return sq === 0 ? 0 : (sum * sum) / (values.length * sq);
}
export function fairness(agents: AgentTick[]) {
  let weighted = 0,
    demand = 0;
  for (const tier of [1, 2, 3]) {
    const group = agents.filter((a) => a.tier === tier),
      d = group.reduce((s, a) => s + a.demand, 0);
    weighted += d * jain(group.map((a) => a.service));
    demand += d;
  }
  return Math.min(1, demand ? weighted / demand : 1);
}
