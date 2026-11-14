import type {
  Allocation,
  BusId,
  Config,
  AgentId,
  ScenarioEvent,
} from "../contract/types";
import { rng } from "./rng";
export interface Environment {
  supply: number;
  busCaps: Record<BusId, number>;
  feederCaps: Allocation;
  multipliers: Allocation;
  crashed: AgentId[];
  flooded: boolean;
  forceDrop: boolean;
  events: string[];
}
export function environment(
  config: Config,
  t: number,
  injected: ScenarioEvent[] = [],
): Environment {
  const random = rng(config.seed ^ 0x5043);
  const schedule = config.scenario.events.map((e) => ({
    ...e,
    tick: Math.max(
      0,
      Math.min(
        143,
        e.tick + Math.round((random() * 2 - 1) * config.scenario.timingJitter),
      ),
    ),
  }));
  const env: Environment = {
    supply: config.scenario.initialSupply,
    busCaps: Object.fromEntries(
      config.network.buses.map((b) => [b.id, b.capacity]),
    ) as Record<BusId, number>,
    feederCaps: Object.fromEntries(
      config.network.feeders.map((f) => [f.id, f.capacity]),
    ) as Allocation,
    multipliers: Object.fromEntries(
      config.profiles.agents.map((p) => [p.id, 1]),
    ) as Allocation,
    crashed: [],
    flooded: false,
    forceDrop: false,
    events: [],
  };
  for (const e of [...schedule, ...injected].sort((a, b) => a.tick - b.tick)) {
    if (e.tick > t) continue;
    if (e.tick === t) env.events.push(e.label);
    switch (e.type) {
      case "supply":
        env.supply = e.value;
        break;
      case "bus":
        env.busCaps[e.id] = e.value;
        break;
      case "feeder":
        env.feederCaps[e.id] = e.value;
        break;
      case "demand":
        env.multipliers[e.id] = e.value;
        break;
      case "crash":
        if (t < e.tick + e.duration) env.crashed.push(e.id);
        else if (t === e.tick + e.duration) env.events.push(`${e.id} rejoined`);
        break;
      case "flood":
        env.flooded = config.enabledAgents.includes("fuel");
        break;
      case "drop":
        env.forceDrop = e.tick === t;
        break;
    }
  }
  return env;
}
