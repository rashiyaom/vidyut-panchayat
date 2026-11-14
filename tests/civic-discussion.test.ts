import { describe, expect, it } from "vitest";
import {
  civicAdvisory,
  civicDiscussion,
  protocolDiscussion,
  readingTime,
} from "../src/ui/civicDiscussion";
import { conversation } from "../src/ui/councilConversation";
import { run } from "../src/engine/world";
import { config } from "./fixtures";
const initial = run(config, 1)[0];

describe("civic deliberation", () => {
  it("provides a complete, deterministic discussion before the first tick", () => {
    const turns = civicDiscussion(null, config);
    expect(turns).toEqual(civicDiscussion(null, config));
    expect(new Set(turns.map((t) => t.speaker)).size).toBe(10);
    expect(new Set(turns.map((t) => t.topic))).toEqual(
      new Set(["Electricity", "Water", "Public safety", "Resolution"]),
    );
    expect(turns.every((t) => t.text.split(/\s+/).length >= 45)).toBe(true);
    expect(turns.some((t) => t.sentiment === "challenge")).toBe(true);
    expect(turns.some((t) => t.text.includes("no completed decision"))).toBe(
      false,
    );
    expect(turns[0].evidence.join()).toContain("no completed decision");
    const seen = new Set<string>();
    for (const turn of turns) {
      if (turn.replyTo) expect(seen.has(turn.replyTo)).toBe(true);
      seen.add(turn.id);
    }
    expect(protocolDiscussion(null)).toEqual([]);
  });
  it("uses actual readings while keeping water shares and safety actions provisional", () => {
    const tick = structuredClone(initial);
    tick.agents.find((a) => a.id === "water")!.service = 0.4;
    tick.agents.find((a) => a.id === "hospital")!.allocated = 13.27;
    const turns = civicDiscussion(tick, config);
    expect(turns.find((t) => t.id === "water-opening")!.text).toContain(
      "40% modelled service",
    );
    expect(
      turns.find((t) => t.id === "hospital-objection")!.evidence.join(),
    ).toContain("13.27");
    const routing = turns.find((t) => t.id === "water-revision")!;
    expect(routing.text).toContain("40% to the hospital");
    expect(routing.text).toContain("proposed schedule");
    expect(turns.find((t) => t.id === "evacuation-challenge")!.text).toContain(
      "should not claim the beach has been cleared",
    );
  });
  it("escalates and de-escalates scenario alerts from current supply and phase", () => {
    expect(civicAdvisory(null, config).level).toBe("ready");
    const tick = { ...initial, t: 54, supply: 55 };
    expect(civicAdvisory(tick, config).level).toBe("red");
    expect(
      civicDiscussion(tick, config).find((t) => t.id === "public-notice")!
        .sentiment,
    ).toBe("urgent");
    expect(civicAdvisory({ ...tick, t: 84, supply: 120 }, config).level).toBe(
      "amber",
    );
    expect(civicAdvisory({ ...tick, t: 12 }, config).level).toBe("amber");
  });
  it("does not claim unavailable seats are live or a fallback is a new agreement", () => {
    const tick = structuredClone(initial);
    tick.agents.find((a) => a.id === "water")!.isDown = true;
    tick.negotiation.outcome = "fallback";
    const turns = civicDiscussion(tick, config);
    expect(
      turns.filter((t) => t.speaker === "water").every((t) => t.unavailable),
    ).toBe(true);
    expect(turns.at(-1)!.text).toContain("fallback");
    expect(protocolDiscussion(tick).map((t) => t.protocol)).toEqual(
      conversation(tick),
    );
  });
  it("allows time to read elaborated messages", () => {
    expect(readingTime("short message")).toBe(7000);
    expect(readingTime("word ".repeat(70))).toBeGreaterThan(20000);
    expect(readingTime("word ".repeat(300))).toBe(32000);
  });
});
