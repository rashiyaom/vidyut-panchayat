import type { AgentTick, Metrics, Tick, Trace } from "../../contract/types";
import { fairness } from "../policy/fairness";
import { phl } from "./impact";
export function score(
  agents: AgentTick[],
  trace: Trace,
  previous: Metrics | undefined,
  count: number,
): Metrics {
  const critical = agents.filter((a) => a.tier === 1),
    up = critical.filter((a) => a.service >= 0.9).length / critical.length;
  return {
    phl: (previous?.phl ?? 0) + phl(agents),
    damage: (previous?.damage ?? 0) + agents.reduce((s, a) => s + a.harm, 0),
    criticalUptime:
      ((previous?.criticalUptime ?? 0) * (count - 1) + up) / count,
    hospitalMin: Math.min(
      previous?.hospitalMin ?? 1,
      agents.find((a) => a.id === "hospital")!.service,
    ),
    fairness:
      ((previous?.fairness ?? 0) * (count - 1) + fairness(agents)) / count,
    weightedService:
      (previous?.weightedService ?? 0) +
      agents.reduce((s, a) => s + a.weight * a.allocated, 0),
    violations: 0,
    blocked: (previous?.blocked ?? 0) + trace.blocked,
    aborts: (previous?.aborts ?? 0) + trace.aborts,
    fallbacks: (previous?.fallbacks ?? 0) + Number(trace.fallback),
    adherence:
      ((previous?.adherence ?? 0) * (count - 1) +
        Number(trace.outcome === "plan")) /
      count,
  };
}
export function windowMetrics(ticks: Tick[]): Metrics {
  let result: Metrics | undefined;
  for (const [i, tick] of ticks.entries())
    result = score(tick.agents, tick.negotiation, result, i + 1);
  if (!result) throw new Error("Empty metric window");
  return result;
}
