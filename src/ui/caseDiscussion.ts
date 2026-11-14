import type { AgentId, Config, Tick } from "../contract/types";
import type { CaseId } from "../contract/cases";
import type { CouncilTurn, Topic } from "./civicDiscussion";

const order: Record<CaseId, AgentId[]> = {
  cyclone: [
    "hospital",
    "transit",
    "traffic",
    "water",
    "shelter",
    "fuel",
    "telecom",
    "residential",
    "commercial",
  ],
  flood: [
    "water",
    "fuel",
    "hospital",
    "shelter",
    "traffic",
    "transit",
    "telecom",
    "residential",
    "commercial",
  ],
  heatwave: [
    "residential",
    "hospital",
    "shelter",
    "water",
    "commercial",
    "fuel",
    "telecom",
    "transit",
    "traffic",
  ],
  fault: [
    "telecom",
    "hospital",
    "fuel",
    "water",
    "traffic",
    "transit",
    "shelter",
    "residential",
    "commercial",
  ],
  historical: [
    "hospital",
    "water",
    "telecom",
    "residential",
    "fuel",
    "traffic",
    "transit",
    "shelter",
    "commercial",
  ],
};
const issue: Record<CaseId, string> = {
  cyclone: "coastal access, shelter readiness and electricity loss",
  flood: "pumping, treated-water access and fuel-depot exposure",
  heatwave: "cooling demand, hospital load and shelter access",
  fault: "central bus limits, hospital feeder capacity and message delivery",
  historical: "held-out meter demand against an illustrative local grid",
};
const actions: Record<AgentId, Record<CaseId, string>> = {
  emergency: {
    cyclone:
      "Coordinate assessed coastal assistance; do not claim an evacuation is complete.",
    flood:
      "Coordinate flood response using verified routes and facility status.",
    heatwave:
      "Coordinate heat assistance without claiming a measured patient count.",
    fault:
      "Verify communications and feeder status before issuing instructions.",
    historical: "Separate measured signals from simulated local decisions.",
  },
  hospital: {
    cyclone:
      "Protect critical care and check water and backup before promising continuous treatment.",
    flood:
      "Confirm protected water and power windows before announcing capacity.",
    heatwave:
      "Protect care and essential cooling while checking backup endurance.",
    fault:
      "Check feeder capacity and backup duration before asking for restoration.",
    historical:
      "Protect simulated critical care; anonymous meters are not hospital meters.",
  },
  water: {
    cyclone: "Check treatment and pumping before proposing delivery windows.",
    flood:
      "Prioritise treatment and pumping; verify storage and quality before proposing distribution.",
    heatwave:
      "Check pumping and treatment before proposing hydration distribution.",
    fault: "Assess pumping and treatment exposure to the bus fault.",
    historical:
      "Assess simulated pumping; no real pipe flow or litres are present.",
  },
  telecom: {
    cyclone:
      "Prepare one consistent warning and an offline route if connectivity weakens.",
    flood:
      "Publish provisional water and access notices through more than one channel.",
    heatwave:
      "Explain heat precautions and the next update through accessible channels.",
    fault:
      "Use redundant channels; agent message losses do not measure public network coverage.",
    historical:
      "Use protocol delivery records for agent messages, not public coverage.",
  },
  fuel: {
    cyclone:
      "Check depot access and hospital backup delivery; reserve is finite.",
    flood:
      "Check whether the depot is accessible before relying on replenishment.",
    heatwave:
      "Confirm finite reserve and delivery access for critical cooling loads.",
    fault: "Verify backup stock and access if a feeder cannot be restored.",
    historical:
      "Track modelled backup hours; no real depot inventory was measured.",
  },
  shelter: {
    cyclone:
      "Verify reception, sanitation and accessible entry before increasing intake.",
    flood: "Match intake to verified water and sanitation capacity.",
    heatwave: "Verify cooling, water and staffing before announcing places.",
    fault:
      "Confirm power, water and communications before promising reception.",
    historical: "Check simulated dependencies before proposing intake.",
  },
  transit: {
    cyclone: "Offer assisted transport only on routes confirmed usable.",
    flood: "Offer assisted journeys only after route and vehicle checks.",
    heatwave: "Plan access to cooling locations within available service.",
    fault: "Adjust service to actual traction power and communications.",
    historical: "Scale transport to mapped demand and committed allocation.",
  },
  traffic: {
    cyclone: "Prioritise emergency access and verify coastal roads.",
    flood: "Inspect flooded approaches and preserve access to care and water.",
    heatwave: "Keep hospital and cooling-shelter approaches accessible.",
    fault: "Protect emergency signals and plan manual control if needed.",
    historical: "Review simulated signal service before proposing access.",
  },
  residential: {
    cyclone: "Ask for clear household instructions and accessible assistance.",
    flood: "Ask how households without transport will obtain safe water.",
    heatwave:
      "Request a fair cooling plan and targeted help for vulnerable residents.",
    fault: "Ask for clear outage areas and realistic update times.",
    historical:
      "Present household impacts as modelled service, not measured residents.",
  },
  commercial: {
    cyclone: "Defer discretionary loads before care or shelter power.",
    flood: "Reduce discretionary demand while pumping and care are protected.",
    heatwave: "Defer decorative and non-critical cooling demand first.",
    fault: "Release flexible demand to protect critical feeders.",
    historical: "Offer flexible simulated demand when forecast pressure rises.",
  },
};
const clock = (t: number) =>
  `${String(Math.floor(t / 6)).padStart(2, "0")}:${String((t % 6) * 10).padStart(2, "0")}`;
export function caseDiscussion(
  tick: Tick | null,
  config: Config,
  id: CaseId,
): CouncilTurn[] {
  const profile = (agent: AgentId) =>
    config.profiles.agents.find((p) => p.id === agent)!;
  const actual = (agent: AgentId) => tick?.agents.find((a) => a.id === agent);
  const supply = tick?.supply ?? config.scenario.initialSupply;
  const requested = tick
    ? tick.agents.reduce((sum, a) => sum + a.demand, 0)
    : config.profiles.agents.reduce((sum, p) => sum + p.demand, 0);
  const phase = tick
    ? `At ${clock(tick.t)} (tick ${tick.t}), ${tick.events.join("; ") || "no new event was recorded"}.`
    : `Before the first decision, the case is ${issue[id]}.`;
  const status = (agent: AgentId) => {
    const a = actual(agent);
    return a
      ? `${a.allocated.toFixed(1)} of ${a.demand.toFixed(1)} PU allocated, ${Math.round(a.service * 100)}% modelled service and ${a.reserveHours.toFixed(1)} h reserve`
      : `${profile(agent).demand.toFixed(1)} PU baseline request; no committed allocation`;
  };
  const turns: CouncilTurn[] = [];
  const add = (
    speaker: AgentId,
    topic: Topic,
    title: string,
    text: string,
    evidence: string[],
    urgent = false,
  ) => {
    turns.push({
      id: `${id}-${tick?.t ?? "pre"}-${turns.length}`,
      speaker,
      topic,
      title,
      text,
      replyTo: turns.at(-1)?.id,
      sentiment: urgent ? "urgent" : turns.length ? "proposal" : "information",
      evidence,
      unavailable:
        !!actual(speaker)?.isDown || !config.enabledAgents.includes(speaker),
    });
  };
  add(
    "emergency",
    "Electricity",
    `Open case · ${issue[id]}`,
    `${phase} Available supply is ${supply.toFixed(1)} PU against ${requested.toFixed(1)} PU requested. ${actions.emergency[id]} Each response action in this briefing is a proposal; the electricity result will be recorded by the engine.`,
    [
      phase,
      `Supply ${supply.toFixed(1)} PU; demand ${requested.toFixed(1)} PU.`,
    ],
  );
  for (const speaker of order[id]) {
    const a = actual(speaker),
      p = profile(speaker),
      previous = turns.at(-1)!;
    const stressed = !!a && (a.service < 0.8 || a.isDown);
    const topic: Topic =
      speaker === "water"
        ? "Water"
        : ["traffic", "transit", "shelter", "residential", "telecom"].includes(
              speaker,
            )
          ? "Public safety"
          : "Electricity";
    const observation = a
      ? `The committed simulation result for ${p.label} is ${status(speaker)}.`
      : `The current planning baseline for ${p.label} is ${status(speaker)}.`;
    const reaction =
      a?.isDown || !config.enabledAgents.includes(speaker)
        ? `${p.label} is unavailable; this is a prepared brief from the recorded state.`
        : stressed
          ? `I challenge ${profile(previous.speaker).label}'s proposal because our service is ${Math.round(a!.service * 100)}%.`
          : `I hear ${profile(previous.speaker).label}'s concern and will test my part of the response.`;
    const caveat =
      speaker === "water"
        ? "Any water routing here remains a proposal; pipe flow, quality and litres are not measured."
        : speaker === "telecom"
          ? `The agent protocol has ${tick ? tick.negotiation.messages.filter((m) => !m.delivered).length : 0} lost deliveries this tick; that is not a measure of residents' connectivity.`
          : `Our configured priority is tier ${p.tier}${p.dependsOn.length ? `, with dependencies on ${p.dependsOn.map((dep) => profile(dep.agent).label).join(" and ")}` : ""}.`;
    add(
      speaker,
      topic,
      stressed
        ? `${p.label} · service under strain`
        : `${p.label} · response proposal`,
      `${reaction} ${observation} ${actions[speaker][id]} ${caveat}`,
      [observation, `Case: ${issue[id]}. ${phase}`],
      stressed,
    );
  }
  const worst = tick
    ? [...tick.agents].sort((a, b) => a.service - b.service)[0]
    : null;
  if (tick?.events.length)
    add(
      "emergency",
      "Public safety",
      "New event · reassess this plan",
      `The recorded event is ${tick.events.join("; ")}. We should recheck current supply ${tick.supply.toFixed(1)} PU, the electrical constraints and each affected service before repeating an earlier recommendation. ${actions.emergency[id]}`,
      tick.events.map((event) => `Recorded engine event: ${event}.`),
      true,
    );
  if (worst && worst.service < 0.7)
    add(
      worst.id,
      worst.id === "water" ? "Water" : "Electricity",
      "Lowest-service utility requests review",
      `${profile(worst.id).label} has ${Math.round(worst.service * 100)}% effective service after receiving ${worst.allocated.toFixed(1)} of ${worst.demand.toFixed(1)} PU. ${worst.isDown ? "This is a prepared brief because the seat is unavailable." : "I ask the council to explain why this allocation is safe before the next interval."} ${actions[worst.id][id]}`,
      [`Recorded tick ${tick!.t}: ${status(worst.id)}.`],
      true,
    );
  const losses =
    tick?.negotiation.messages.filter((message) => !message.delivered).length ??
    0;
  if (losses > 0)
    add(
      "telecom",
      "Electricity",
      "Agent message delivery needs review",
      `The protocol recorded ${losses} lost agent-message deliveries this tick. This can change negotiation timing or force a safe fallback. It does not measure public phone coverage. ${actions.telecom[id]}`,
      [
        `Protocol: ${losses} lost deliveries from ${tick!.negotiation.messages.length} messages.`,
      ],
      true,
    );
  add(
    "emergency",
    "Resolution",
    "Council brief and next check",
    `${worst ? `${profile(worst.id).label} has the lowest modelled service at ${Math.round(worst.service * 100)}%; review this utility first in the next interval.` : "The first electricity plan still requires human approval."} ${tick?.negotiation.outcome === "fallback" ? "The engine applied a safe fallback; this is not a new agreement." : tick ? `The protocol recorded a ${tick.negotiation.outcome} outcome and ${tick.negotiation.aborts} aborts.` : "The engine will record electricity messages after execution."} ${actions.emergency[id]} Water routing and public response remain proposals until independently verified.`,
    [
      tick
        ? `Protocol outcome ${tick.negotiation.outcome}; hash ${tick.negotiation.hash}.`
        : "Awaiting first committed tick.",
    ],
  );
  return turns;
}
