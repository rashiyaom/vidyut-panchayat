import type { AgentId, Config, Tick } from "../contract/types";
import { conversation, type ConversationEntry } from "./councilConversation";
import type { CaseId } from "../contract/cases";
import { caseDiscussion } from "./caseDiscussion";

export type Topic =
  "Electricity" | "Water" | "Public safety" | "Resolution" | "Protocol";
export type Sentiment =
  "proposal" | "concern" | "challenge" | "agreement" | "urgent" | "information";
export interface CouncilTurn {
  id: string;
  speaker: AgentId;
  topic: Topic;
  sentiment: Sentiment;
  title: string;
  text: string;
  replyTo?: string;
  evidence: string[];
  unavailable?: boolean;
  protocol?: ConversationEntry;
}
const scenarioCases = {
  cyclone_24h: "cyclone",
  urban_flood_24h: "flood",
  heatwave_24h: "heatwave",
  grid_fault_24h: "fault",
} as const;
export const caseForScenario = (scenario: Config["scenario"]["id"]): CaseId =>
  scenarioCases[scenario];
export function civicAdvisory(
  tick: Tick | null,
  config: Config,
  selected?: CaseId,
) {
  const id = selected ?? caseForScenario(config.scenario.id);
  const ratio =
    (tick?.supply ?? config.scenario.initialSupply) /
    Math.max(1, config.scenario.initialSupply);
  const red =
    !!tick && (ratio < 0.5 || tick.agents.some((a) => a.service < 0.5));
  const watch =
    !!tick && (ratio < 0.8 || tick.agents.some((a) => a.service < 0.8));
  const guidance: Record<CaseId, string> = {
    cyclone:
      "Assess coastal access, shelter readiness and assisted movement before any public instruction.",
    flood:
      "Verify water quality, pumping, depot access and routes before announcing distribution windows.",
    heatwave:
      "Check care, cooling access and water before announcing shelter availability.",
    fault:
      "Verify feeder status and redundant communications before announcing restoration.",
    historical:
      "This replay uses measured demand and national load, trained forecasts and an illustrative local network. No real utility response is observed.",
  };
  return {
    level: red ? "red" : watch ? "amber" : "ready",
    title: `${red ? "HIGH STRAIN" : watch ? "WATCH" : "READINESS"} · ${id === "historical" ? "Historical data replay" : config.scenario.id.replaceAll("_", " ")}`,
    text: guidance[id],
  };
}
/** Rule-based scenario briefing grounded in the selected case and committed tick. */
export function civicDiscussion(
  tick: Tick | null,
  config: Config,
  selected?: CaseId,
): CouncilTurn[] {
  return caseDiscussion(
    tick,
    config,
    selected ?? caseForScenario(config.scenario.id),
  );
}
export function protocolDiscussion(tick: Tick | null): CouncilTurn[] {
  return conversation(tick).map((entry, i) => ({
    id: `protocol-${i}`,
    speaker: entry.message.sender,
    topic: "Protocol",
    sentiment:
      entry.message.type === "ABORT"
        ? "urgent"
        : entry.message.type === "COMMIT"
          ? "agreement"
          : "information",
    title: entry.message.type,
    text: entry.text,
    evidence: [
      `${entry.deliveries} delivery records · ${entry.lost} lost`,
      `Attempt ${entry.message.attempt + 1}${entry.message.phase ? ` · ${entry.message.phase}` : ""}`,
    ],
    protocol: entry,
  }));
}
export function readingTime(text: string) {
  return Math.min(32000, Math.max(7000, text.split(/\s+/).length * 310));
}
