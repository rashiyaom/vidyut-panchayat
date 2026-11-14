import { describe, expect, it } from "vitest";
import {
  civicAdvisory,
  civicDiscussion,
  protocolDiscussion,
  readingTime,
} from "../src/ui/civicDiscussion";
import { configForCase, cases } from "../src/contract/cases";
import { decisionPdfBytes } from "../src/ui/decisionPdf";
import { resultDashboard } from "../src/ui/resultDashboard";
import { conversation } from "../src/ui/councilConversation";
import { run } from "../src/engine/world";
import { initialWorld } from "../src/engine/world";
import { createPlan } from "../src/engine/planning/planner";

describe("case-driven council discussion", () => {
  it("loads distinct validated emergencies and different agendas", () => {
    const openings = new Set<string>();
    const sequences = new Set<string>();
    for (const item of cases) {
      const config = configForCase(42, item.id);
      const plan = createPlan(initialWorld(config), 18);
      expect(plan.constitution.ok).toBe(true);
      const turns = civicDiscussion(null, config, item.id);
      openings.add(turns[0].text);
      sequences.add(turns.map((turn) => turn.speaker).join(","));
      expect(new Set(turns.map((turn) => turn.speaker)).size).toBe(10);
      expect(turns.some((turn) => turn.topic === "Water")).toBe(true);
      expect(turns.some((turn) => turn.topic === "Public safety")).toBe(true);
      expect(turns.every((turn) => turn.evidence.length > 0)).toBe(true);
      const seen = new Set<string>();
      for (const turn of turns) {
        if (turn.replyTo) expect(seen.has(turn.replyTo)).toBe(true);
        seen.add(turn.id);
      }
    }
    expect(openings.size).toBe(5);
    expect(sequences.size).toBe(5);
  });
  it("changes with the committed tick and reports real protocol separately", () => {
    const config = configForCase(42, "flood");
    const tick = run(config, 1)[0];
    const before = civicDiscussion(null, config, "flood");
    const after = civicDiscussion(tick, config, "flood");
    expect(after[0].text).toContain("tick 0");
    expect(after[0].text).not.toEqual(before[0].text);
    expect(after.find((turn) => turn.speaker === "water")?.text).toContain(
      "committed simulation result",
    );
    expect(after.find((turn) => turn.speaker === "water")?.text).toContain(
      "pipe flow",
    );
    expect(after.find((turn) => turn.speaker === "telecom")?.text).toContain(
      "not a measure of residents",
    );
    expect(protocolDiscussion(tick).map((turn) => turn.protocol)).toEqual(
      conversation(tick),
    );
  });
  it("keeps unavailable seats and fallback claims honest", () => {
    const config = configForCase(42, "fault");
    const tick = structuredClone(run(config, 1)[0]);
    tick.agents.find((agent) => agent.id === "telecom")!.isDown = true;
    tick.negotiation.outcome = "fallback";
    const turns = civicDiscussion(tick, config, "fault");
    expect(turns.find((turn) => turn.speaker === "telecom")?.unavailable).toBe(
      true,
    );
    expect(turns.at(-1)?.text).toContain("safe fallback");
    expect(civicAdvisory({ ...tick, supply: 35 }, config, "fault").level).toBe(
      "red",
    );
  });
  it("produces a downloadable three-page record and correct interval loss", () => {
    const config = configForCase(42, "cyclone");
    const tick = run(config, 1)[0];
    const pdf = new TextDecoder().decode(
      decisionPdfBytes(tick, config, "cyclone", [tick]),
    );
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Count 3");
    expect(pdf).toContain("VIDYUT PANCHAYAT");
    expect(pdf).toContain("WATER AI");
    expect(pdf).toContain("TELECOM AI");
    expect(pdf).toContain("%%EOF");
    const dashboard = resultDashboard(tick, config, [tick], "cyclone");
    expect(dashboard).toContain("FULL ALLOCATION LEDGER");
    expect(dashboard).toContain("Download decision PDF");
    expect(dashboard).toContain("Service loss per interval");
  });
  it("keeps the replay speed estimate bounded", () => {
    expect(readingTime("short message")).toBe(7000);
    expect(readingTime("word ".repeat(300))).toBe(32000);
  });
});
