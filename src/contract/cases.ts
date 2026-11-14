import type { Config } from "./types";
import { configSchema } from "./schemas";
import profiles from "../../data/agents/profiles.json";
import network from "../../data/network/electrical_v1.json";
import cyclone from "../../data/scenarios/cyclone_24h.json";
import flood from "../../data/scenarios/urban_flood_24h.json";
import heatwave from "../../data/scenarios/heatwave_24h.json";
import fault from "../../data/scenarios/grid_fault_24h.json";

export const cases = [
  {
    id: "cyclone",
    title: "Cyclone & coastal disruption",
    question:
      "How should the city protect care, water and shelter during grid loss?",
    source: "Authored emergency · simulated grid",
  },
  {
    id: "flood",
    title: "Urban flood & water access",
    question:
      "What happens when pumping, shelter demand and fuel access collide?",
    source: "Authored emergency · simulated grid",
  },
  {
    id: "heatwave",
    title: "Heatwave & peak demand",
    question: "Can essential cooling and care survive a supply squeeze?",
    source: "Authored emergency · simulated grid",
  },
  {
    id: "fault",
    title: "Distribution fault & telecom crash",
    question:
      "How does the council respond to a central bus failure and lost communications?",
    source: "Authored emergency · simulated grid",
  },
  {
    id: "historical",
    title: "Historical data replay",
    question:
      "How does the council use held-out meter forecasts under an authored stress test?",
    source:
      "Held-out meter demand and weather · real Portugal load · authored cyclone and local grid",
  },
] as const;
export type CaseId = (typeof cases)[number]["id"];
export function caseId(value: string | null): CaseId {
  return cases.some((item) => item.id === value)
    ? (value as CaseId)
    : "cyclone";
}
export function caseInfo(id: CaseId) {
  return cases.find((item) => item.id === id)!;
}
export function configForCase(seed: number, id: CaseId): Config {
  const scenario =
    id === "flood"
      ? flood
      : id === "heatwave"
        ? heatwave
        : id === "fault"
          ? fault
          : cyclone;
  return configSchema.parse({
    version: 1,
    seed,
    strategy: "council",
    profiles,
    network,
    scenario,
    enabledAgents: profiles.agents.map((agent) => agent.id),
  });
}
