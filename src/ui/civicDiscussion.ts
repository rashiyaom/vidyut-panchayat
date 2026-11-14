import type { AgentId, Config, Tick } from "../contract/types";
import { conversation, type ConversationEntry } from "./councilConversation";

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
export function civicAdvisory(tick: Tick | null, config: Config) {
  const cyclone = (tick?.scenario ?? config.scenario.id) === "cyclone_24h";
  const landfall =
    config.scenario.events.find((e) => /landfall/i.test(e.label))?.tick ??
    Infinity;
  const ratio =
    (tick?.supply ?? config.scenario.initialSupply) /
    Math.max(1, config.scenario.initialSupply);
  const red = !!tick && ratio < 0.5 && (!cyclone || tick.t >= landfall);
  const watch =
    !!tick && (ratio < 0.8 || tick.agents.some((a) => a.service < 0.6));
  return {
    level: red ? "red" : watch ? "amber" : "ready",
    title: red
      ? "RED ALERT · City safety proposal"
      : watch
        ? "AMBER WATCH · Essential services under strain"
        : "City readiness · Prepare before disruption",
    text:
      red && cyclone
        ? "Proposed public notice: stay indoors; do not visit Palm Beach. Move people already at the coast to an assessed safe shelter with emergency-team assistance."
        : red
          ? "Proposed public notice: avoid non-essential travel while critical services are disrupted. Keep emergency access routes clear."
          : watch
            ? "Review water access, hospital backup and shelter readiness. Coastal restrictions remain a proposed precaution; this is not a live weather bulletin."
            : "Check water distribution, transport assistance and coastal evacuation arrangements before the scenario worsens.",
  };
}
/** Authored, deterministic scenario deliberation; never masquerades as engine messages or applied water flow. */
export function civicDiscussion(
  tick: Tick | null,
  config: Config,
): CouncilTurn[] {
  const profile = (id: AgentId) =>
    config.profiles.agents.find((p) => p.id === id)!;
  const agent = (id: AgentId) => tick?.agents.find((a) => a.id === id);
  const demand = (id: AgentId) =>
    (agent(id)?.demand ?? profile(id).demand).toFixed(2);
  const service = (id: AgentId) =>
    agent(id)
      ? `${(agent(id)!.service * 100).toFixed(0)}% modelled service`
      : "service has not yet been measured";
  const facts = (id: AgentId) =>
    agent(id)
      ? `${profile(id).label}: ${agent(id)!.allocated.toFixed(2)} / ${demand(id)} PU allocated; ${service(id)}.`
      : `${profile(id).label} planning baseline: ${demand(id)} PU requested; no completed decision yet.`;
  const supply = tick?.supply ?? config.scenario.initialSupply;
  const total = tick
    ? tick.agents.reduce((sum, a) => sum + a.demand, 0)
    : config.profiles.agents.reduce((sum, p) => sum + p.demand, 0);
  const scarce = supply < total;
  const advisory = civicAdvisory(tick, config);
  const critical = advisory.level === "red";
  const waterStressed = !!agent("water") && agent("water")!.service < 0.7;
  const hospitalStressed =
    !!agent("hospital") && agent("hospital")!.service < 0.8;
  const turns: CouncilTurn[] = [];
  const add = (
    id: string,
    speaker: AgentId,
    topic: Topic,
    sentiment: Sentiment,
    title: string,
    text: string,
    replyTo?: string,
    evidence: string[] = [facts(speaker)],
  ) => {
    turns.push({
      id,
      speaker,
      topic,
      sentiment,
      title,
      text,
      replyTo,
      evidence,
      unavailable:
        agent(speaker)?.isDown || !config.enabledAgents.includes(speaker),
    });
  };
  add(
    "opening",
    "emergency",
    "Electricity",
    scarce ? "concern" : "information",
    "Start with people, not just power units",
    `The city has ${supply.toFixed(2)} power units available against ${total.toFixed(2)} requested. A power unit, or PU, is this simulation’s measure of electricity, not a patient count or a water volume. ${scarce ? "We cannot satisfy every request at once, so each department must explain what people would lose if its service is cut." : "There is enough total supply for these requests, but individual electrical lines and service dependencies can still limit delivery."} Let us discuss hospital care and essential transport first, then drinking-water distribution, and finally the safety of people at Palm Beach and across the city.`,
  );
  add(
    "transport-request",
    "transit",
    "Electricity",
    "proposal",
    "Keep a useful transport service running",
    `Transit requests ${demand("transit")} PU. I propose prioritising journeys that connect neighbourhoods to the hospital and shelter rather than keeping every ordinary route running. If evacuation becomes necessary, people without cars will need assistance too. Hospital, please tell us where our request competes with critical care; Traffic, please identify which access corridors would need protection before we describe any route as available.`,
    "opening",
  );
  add(
    "hospital-objection",
    "hospital",
    "Electricity",
    scarce || hospitalStressed ? "challenge" : "concern",
    "Hospital care must not absorb an avoidable cut",
    `Transit, I support essential journeys, but I object to treating the full transport request as equally urgent as critical hospital services. Our request is ${demand("hospital")} PU, with a configured minimum of ${profile("hospital").minViable.toFixed(2)} PU. ${hospitalStressed ? `Our current result is only ${service("hospital")}; that makes further concessions especially concerning.` : "Patients who depend on continuous care cannot simply wait for the next discussion."} Could you reduce ordinary trips first? Water and Fuel must also be heard: electricity alone does not keep a hospital functioning.`,
    "transport-request",
  );
  add(
    "traffic-response",
    "traffic",
    "Electricity",
    "agreement",
    "Protect ambulance access before routine traffic",
    `Hospital, that is a fair distinction. I propose keeping critical junctions on hospital and shelter approaches ahead of routine traffic convenience. Traffic requests ${demand("traffic")} PU; the minimum configured for this service is ${profile("traffic").minViable.toFixed(2)} PU. This is not a promise that every road is clear. Emergency teams would still need to assess obstructions, and Transit should plan around those assessments rather than assume an unrestricted road network.`,
    "hospital-objection",
  );
  add(
    "transport-concession",
    "transit",
    "Electricity",
    "agreement",
    "Revise the transport priority",
    `I accept the hospital’s priority argument for this scenario discussion. My revised proposal is to reduce non-essential trips first and preserve an assessed hospital–shelter connection where possible. ${agent("transit") ? `The recorded electricity result for Transit is ${agent("transit")!.allocated.toFixed(2)} PU; my proposal does not change that committed number.` : "The electricity allocation still needs to go through the plan and approval process."} If the final service cannot support transport, Emergency must arrange an alternative rather than announce buses that cannot operate.`,
    "hospital-objection",
  );
  add(
    "business-concession",
    "commercial",
    "Electricity",
    "proposal",
    "Defer discretionary commercial demand",
    `I propose postponing decorative lighting and other discretionary commercial use before asking essential services for another reduction. Our baseline request is ${demand("commercial")} PU, but power savings should be reviewed against the actual network limits. Residential, I also support predictable notices: businesses and households need to know the reason for restrictions and when the council will review them, rather than receiving an unexplained outage.`,
    "transport-concession",
  );
  add(
    "fuel-dependency",
    "fuel",
    "Electricity",
    "concern",
    "Backup power still needs a support chain",
    `Hospital, backup is a temporary bridge, not an unlimited substitute for electricity. ${agent("hospital") ? `The model records ${agent("hospital")!.reserveHours.toFixed(2)} hours of hospital reserve remaining.` : "The hospital profile includes a finite reserve; we do not yet have a live reserve reading."} Fuel delivery also depends on traffic access and communications. I propose checking depot availability and a safe delivery route before relying on replenishment. A flooded or unavailable depot must never be described as ready merely because we allocated it power.`,
    "hospital-objection",
    [facts("fuel"), facts("hospital")],
  );

  add(
    "water-opening",
    "water",
    "Water",
    waterStressed ? "concern" : "proposal",
    "Now decide where the available water should go",
    `Electricity is only the first part of our responsibility. ${agent("water") ? `Water currently provides ${service("water")}` : "We do not yet have a completed water-service reading"}. ${waterStressed ? "Pumping and treatment service is constrained, so a distribution plan must start from what can actually be made available." : "Let us agree on distribution priorities before an interruption forces an improvised response."} As a starting proposal, divide the available treated-water supply into 35% for the hospital/civic area, 25% for shelters, 25% for West Gardens households and 15% for Eastbank households. These are planning shares, not measured litres or executed valve settings.`,
    "fuel-dependency",
  );
  add(
    "residential-water",
    "residential",
    "Water",
    "challenge",
    "Do not leave household water access behind",
    `Water, I support the hospital and shelters, but I challenge a split that leaves households with no clear collection or delivery arrangement. West Gardens and Eastbank still need drinking water, including people who cannot queue or travel easily. Can we state both the area shares and how households would be informed of a collection window? We should avoid promising continuous pressure everywhere when the model reports reduced service.`,
    "water-opening",
  );
  add(
    "shelter-water",
    "shelter",
    "Water",
    "concern",
    "Shelter intake depends on drinking water and sanitation",
    `Residential, I agree that residents outside shelters must be included. At the same time, opening a shelter without a water plan would move the problem indoors. I propose preserving a shelter share for drinking water and sanitation, with delivery scheduled before increasing intake. We have no measured shelter occupancy or tank inventory in this model, so neither the size of a crowd nor a guaranteed number of beds should be invented. Emergency should verify those details before directing people here.`,
    "residential-water",
  );
  add(
    "hospital-water",
    "hospital",
    "Water",
    hospitalStressed ? "urgent" : "concern",
    "Protect hospital water as well as electricity",
    `Water, please give the hospital a protected window for essential supply and ask the facility team to confirm its actual need. ${hospitalStressed ? "Our modelled hospital service is already reduced; an additional water interruption would be a serious planning concern." : "A reliable power allocation still leaves a gap if hospital water access is interrupted."} I am not asking the council to ignore households. I am asking for a priority that is explained openly and reviewed as soon as hospital needs and available treated water are confirmed.`,
    "water-opening",
  );
  add(
    "water-revision",
    "water",
    "Water",
    "proposal",
    "Revised water-routing proposal",
    `${waterStressed || hospitalStressed ? "For this stressed-service scenario, I propose 40% to the hospital/civic area, 25% to shelters, 20% to West Gardens and 15% to Eastbank." : "For the current readiness stage, I propose 25% to the hospital/civic area, 15% to shelters, 35% to West Gardens and 25% to Eastbank, with a protected hospital delivery window."} The shares total 100% of whatever treated water is actually available. Hospital and shelter deliveries come first within agreed windows; household collection and assisted delivery follow. Confirm storage, quality, demand and route safety before implementation. This remains a proposed schedule: the simulation does not calculate pipes, pressure, tank levels or litres.`,
    "hospital-water",
    [
      facts("water"),
      "Proposed area shares total 100%; physical water volume is not modelled.",
    ],
  );
  add(
    "water-notice",
    "telecom",
    "Water",
    "agreement",
    "Explain the water plan in plain language",
    `I propose a notice that names each area, its collection or delivery window, and where residents can request assistance. It must say when the next update is due and whether the schedule is provisional. We should not broadcast an unverified promise of water returning to every tap. ${agent("telecom") ? `Telecom currently has ${service("telecom")}; reduced connectivity means a single digital channel may not reach everyone.` : "Before the first decision, communication coverage has not yet been measured."} Emergency and Residential should prepare an offline notice route as well.`,
    "water-revision",
  );

  add(
    "coastal-guard",
    "emergency",
    "Public safety",
    critical ? "urgent" : "proposal",
    "Coastal safety desk · Palm Beach",
    `${critical ? "I propose activating the red-alert response in this scenario: close public access to Palm Beach and assist people already at the coast towards an assessed safe inland destination." : "I propose a precautionary beach-clearance plan before conditions worsen: identify people on the boardwalk, prepare accessible assistance and agree on a safe inland destination."} The coastal guard’s job is to check the beach and communicate with the shelter team, not simply tell everyone to move. Traffic must assess the route, Shelter must confirm reception, and Telecom must carry one consistent notice.`,
    "water-notice",
  );
  add(
    "evacuation-challenge",
    "shelter",
    "Public safety",
    "challenge",
    "Do not announce evacuation without a receiving plan",
    `Emergency, I support moving people away from the coast when the scenario warrants it, but I object to announcing that every person should come to our building before capacity and access are checked. Water deliveries, accessible entry and assistance for people with limited mobility need named responsibility. Please make the notice say that teams will direct people to an assessed reception point. This council has no live headcount and should not claim the beach has been cleared.`,
    "coastal-guard",
  );
  add(
    "evacuation-route",
    "traffic",
    "Public safety",
    "proposal",
    "Keep rescue access separate from ordinary travel",
    `Shelter, I support that condition. I propose reserving assessed access for emergency vehicles and assisted transport, while asking other traffic to avoid the beach approach. A line drawn on the city view is not proof that a road is safe. Emergency teams need to check floodwater, debris and local access before confirming any route. Transit should join the operation only if its available service can support it.`,
    "evacuation-challenge",
  );
  add(
    "public-notice",
    "telecom",
    "Public safety",
    critical ? "urgent" : "information",
    critical
      ? "Proposed red-alert public notice"
      : "Proposed city readiness notice",
    `${advisory.text} The message should explain the reason for restrictions, give a clear next-update point, and tell residents where to obtain assistance. ${critical ? "Avoid non-essential outdoor trips and keep emergency access clear; people directed to relocate should follow the assessed assistance plan rather than head out without instructions." : "Prepare the contact and assistance arrangements now; do not describe a precautionary plan as a completed evacuation."} This is a notice inside the fictional city scenario, not a real-world emergency broadcast.`,
    "evacuation-route",
    [advisory.title, facts("telecom")],
  );
  add(
    "resident-response",
    "residential",
    "Public safety",
    "concern",
    "Make the instructions usable for residents",
    `Telecom, please make the notice readable for someone hearing it for the first time. Separate “remain indoors” from instructions for people already at the beach who need assisted relocation. Include people without a phone and residents unable to travel independently. We should also explain that the water windows and transport arrangements are proposals awaiting local confirmation, so households do not mistake an attractive dashboard for proof that help has already arrived.`,
    "public-notice",
  );
  add(
    "resolution",
    "emergency",
    "Resolution",
    "agreement",
    "One coordinated safety brief, with clear owners",
    `The proposed priorities are now connected: Hospital identifies essential care needs; Water confirms a feasible distribution schedule; Shelter verifies reception; Traffic assesses access; Transit plans assistance within its service limits; and Telecom prepares consistent public notices. ${tick?.negotiation.outcome === "fallback" ? "The electricity protocol used a fallback this tick, so these discussions must not be described as a successful new power agreement." : tick ? "The electricity result is recorded separately in the committed city state and protocol log." : "The first electricity plan still requires review and approval."} Water routing and evacuation remain scenario proposals until separately verified; no valve operation or completed rescue is being claimed.`,
    "resident-response",
  );
  return turns;
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
