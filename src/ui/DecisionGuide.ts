import type { CouncilStore } from "../app/store";
import type { Config } from "../contract/types";
import { escape } from "./NegotiationFeed";
const time = (tick: number) =>
  `${String(Math.floor(tick / 6)).padStart(2, "0")}:${String((tick % 6) * 10).padStart(2, "0")}`;
export function decisionGuide(store: CouncilStore, config: Config) {
  const p = store.plan,
    r = store.presim;
  if (!p)
    return `<div class="guide-intro"><span class="section-kicker">YOUR ROLE · CITY APPROVER</span><h2>Let's prepare the city.</h2><p>The ten utilities are working out how to share electricity for the next three hours. We will test their plan before asking you to decide.</p><div class="guide-progress"><i style="width:${Math.max(5, store.progress * 100)}%"></i></div><p>${store.state === "PreSimulating" ? `Testing possible futures · ${Math.round(store.progress * 100)}%` : "Preparing a proposed schedule…"}</p></div>`;
  const b = p.blocks[0],
    demand = Object.values(b.demands).reduce((a, b) => a + b, 0),
    allocation = Object.values(b.allocations).reduce((a, b) => a + b, 0),
    hospital = r?.plan.hospitalMin;
  const scale = Math.max(
    1,
    ...Object.values(b.demands),
    ...Object.values(b.allocations),
  );
  const colors = [
    "#327a8d",
    "#b45b48",
    "#397dac",
    "#7767a8",
    "#ac793a",
    "#52796f",
    "#957047",
    "#477a65",
    "#69778f",
    "#5f759e",
  ];
  const ready = store.state === "AwaitingHuman",
    executing = store.state === "Executing";
  const worst = r ? Math.min(...r.baselines.map((b) => b.evidence.phl.p50)) : 0;
  const phlDelta =
    r && worst > 0 ? ((r.plan.phl.p50 - worst) / worst) * 100 : null;
  const timelineMax = Math.max(
    1,
    ...p.blocks.flatMap((block) => [
      block.supply,
      Object.values(block.demands).reduce((sum, value) => sum + value, 0),
    ]),
  );
  const timeline = p.blocks
    .map((block) => {
      const asked = Object.values(block.demands).reduce(
        (sum, value) => sum + value,
        0,
      );
      const given = Object.values(block.allocations).reduce(
        (sum, value) => sum + value,
        0,
      );
      return `<div class="guide-timeline-row"><b>${time(block.fromTick)}–${time(block.toTick + 1)}</b><span class="guide-timeline-track"><i class="asked" style="width:${(asked / timelineMax) * 100}%"></i><i class="supply" style="width:${(block.supply / timelineMax) * 100}%"></i><i class="given" style="width:${(given / timelineMax) * 100}%"></i></span><strong>${given.toFixed(0)} / ${asked.toFixed(0)} PU</strong></div>`;
    })
    .join("");
  const strategies = r
    ? [
        { label: "Council plan", value: r.plan.phl.p50 },
        ...r.baselines.map((baseline) => ({
          label: baseline.strategy.replaceAll("_", " "),
          value: baseline.evidence.phl.p50,
        })),
      ]
    : [];
  const comparisonMax = Math.max(
    1,
    ...strategies.map((strategy) => strategy.value),
  );
  const comparison = strategies
    .map(
      (strategy, index) =>
        `<div class="guide-comparison-row"><b>${escape(strategy.label)}</b><span><i class="${index === 0 ? "council" : "baseline"}" style="width:${(strategy.value / comparisonMax) * 100}%"></i></span><strong>${Math.round(strategy.value).toLocaleString()}</strong></div>`,
    )
    .join("");
  const utilityFocus = (["water", "telecom"] as const)
    .map((id) => {
      const agent = config.profiles.agents.find(
        (profile) => profile.id === id,
      )!;
      const proposed = b.allocations[id],
        requested = b.demands[id];
      return `<div><span>${escape(agent.label)} AI · Tier ${agent.tier}</span><strong>${proposed.toFixed(1)} <small>of ${requested.toFixed(1)} PU requested</small></strong><p>${Math.max(0, requested - proposed).toFixed(1)} PU proposed grid shortfall. ${id === "water" ? "This does not predict pipe flow, water quality or litres delivered." : "This does not predict public mobile coverage or call completion."}</p></div>`;
    })
    .join("");
  const utilityFocusCard = `<article class="guide-card"><span class="section-kicker">WATER AND COMMUNICATIONS</span><h3>Two services to check closely</h3><p>These are proposed electricity allocations for the first half-hour. Effective service will be measured only after the decision runs.</p><div class="guide-utility-focus">${utilityFocus}</div></article>`;
  return `<div class="guide-intro"><span class="section-kicker">A DECISION, NOT A TECHNICAL REPORT</span><h2>${executing ? "The plan is approved." : "Before the city moves, you decide."}</h2><p>${executing ? "Return to the chamber and choose Next decision to watch the first ten minutes unfold." : `Review the proposal for ${time(p.startTick)}–${time(p.startTick + p.horizonTicks)}. Approval allows this schedule to run; it does not guarantee that every service stays fully available.`}</p><div class="guide-steps"><span>01 · Understand the situation</span><span>02 · See what could happen</span><span>03 · Make your decision</span></div></div><div class="guide-layout"><div class="guide-story"><article class="guide-card"><span class="section-kicker">01 / THE SITUATION</span><h3>${b.supply < demand ? "There is less power than the city needs." : "There is enough forecast power for this block."}</h3><p>The council works with a cautious supply estimate, leaving room for forecast error. The figures below describe the first 30-minute block.</p><div class="guide-power"><div><strong>${b.supply.toFixed(0)}</strong><span>power units available<br>under the cautious forecast</span></div><div><strong>${demand.toFixed(0)}</strong><span>power units requested<br>under the bounded forecast</span></div><div><strong>${allocation.toFixed(0)}</strong><span>power units proposed<br>for the first block</span></div></div><p class="guide-footnote">Power units are a simplified measure of electricity. This is not water, ambulance or evacuation dispatch.</p></article><article class="guide-card"><span class="section-kicker">THE NEXT THREE HOURS</span><h3>What the schedule proposes</h3><p>Each row shows requested power, cautious available supply and proposed allocation for one half-hour block.</p><div class="guide-legend"><span><i class="asked"></i>Requested</span><span><i class="supply"></i>Available</span><span><i class="given"></i>Proposed</span></div><div class="guide-timeline">${timeline}</div><p class="guide-footnote">One shared scale: 0–${timelineMax.toFixed(0)} PU. These are forecasts and proposals, not committed delivery.</p></article>${utilityFocusCard}<article class="guide-card"><span class="section-kicker">02 / WHAT THE TESTS SUGGEST</span><h3>${r ? `One plan. ${r.nFutures} possible futures.` : "Testing the proposal…"}</h3><p>We change demand, available electricity and communication failures, then see how this plan performs. These are modelled possibilities, not promises.</p>${r ? `<div class="guide-outcomes"><div><span>Hospital service in a difficult future</span><b>${(hospital!.p10 * 100).toFixed(0)}%</b><p>100% means fully functioning. This is the lower-end estimate of the hospital's worst moment; backup and water or telecom failures also affect it.</p></div><div><span>Expected essential-service loss</span><b>${Math.round(r.plan.phl.p50).toLocaleString()} <small>person-hours</small></b><p>${phlDelta === null ? "Compared with the same futures for alternative allocation rules." : `${Math.abs(phlDelta).toFixed(1)}% ${phlDelta > 0 ? "more" : "less"} than the best alternative's median result.`} Exposure counts are synthetic and can overlap.</p></div></div><div class="guide-comparison"><h4>Estimated service loss by strategy</h4><p>Median synthetic person-hours across the same test futures. Shorter is better.</p>${comparison}</div><div class="guide-safety ${r.autoApproved ? "passed" : "review"}"><b>${r.autoApproved ? "All automatic checks passed." : "Human judgment is needed."}</b><p>${r.autoApproved ? "The plan passed physical safety and outcome checks. You can still inspect or reject it." : "Safe electrical limits do not mean good service for everyone. The concerns below explain why automatic approval is withheld."}</p><ul>${r.guardrails.map((g, i) => `<li><span>${g.pass ? "✓" : "!"}</span>${["The allocation fits supply and distribution limits.", "No electrical safety limits were broken in the tested futures.", "Expected service loss is no worse than the best alternative.", "Hospital service stays at least 80% in the lower-end estimate."][i] ?? escape(g.name)} <b>${g.pass ? "Passed" : "Needs review"}</b></li>`).join("")}</ul></div>` : `<div class="guide-progress"><i style="width:${store.progress * 100}%"></i></div><p>${Math.round(store.progress * 100)}% complete. Approval becomes available after the tests finish.</p>`}</article><article class="guide-card"><span class="section-kicker">THE PROPOSED FIRST HALF-HOUR</span><h3>Where the electricity goes</h3><div class="guide-allocations">${[
    ...config.profiles.agents,
  ]
    .sort((a, c) => b.allocations[c.id] - b.allocations[a.id])
    .map((a) => {
      const given = b.allocations[a.id],
        requested = b.demands[a.id],
        gap = Math.max(0, requested - given);
      const color =
        colors[
          config.profiles.agents.findIndex((p) => p.id === a.id) % colors.length
        ];
      return `<div><span>${escape(a.label)}<small>${gap > 0.05 ? `${gap.toFixed(1)} PU short` : "Request covered"}</small></span><div aria-label="${escape(a.label)}: ${given.toFixed(1)} allocated of ${requested.toFixed(1)} requested power units"><em style="width:${(requested / scale) * 100}%"></em><i style="width:${(given / scale) * 100}%;background:${color}"></i></div><b>${given.toFixed(1)} PU<small>of ${requested.toFixed(1)} requested</small></b></div>`;
    })
    .join(
      "",
    )}</div><p class="guide-footnote">Shared scale: 0–${scale.toFixed(1)} power units. Colour = proposed electricity; pale outline = requested electricity. Sorted by allocation. Backup may cover some shortfall; these bars do not measure overall service.</p></article></div><aside class="guide-decision"><span class="section-kicker">03 / YOUR DECISION</span><h3>${executing ? "Ready to observe." : "Allow this plan to run?"}</h3><p>Approval applies only to this exact proposal. If conditions change, agents may negotiate a safe adjustment and request a new plan.</p><button id="guide-approve" ${ready ? "" : "disabled"}>${executing ? "Plan approved ✓" : "Approve this plan →"}</button><button id="guide-watch">${executing ? "Go to the council room" : "Inspect the council room"}</button><label for="guide-note">Prefer another proposal?</label><textarea id="guide-note" placeholder="Record your reason for rejecting…"></textarea><button id="guide-reject" ${ready ? "" : "disabled"}>Reject & request a new plan</button><p class="guide-footnote">Your note is recorded with the new proposal. It is not interpreted as an instruction to an AI model.</p><details><summary>Proposal identity</summary><code>${escape(p.id)}<br>${escape(p.hash)}</code></details><p class="guide-footnote">Human approval pauses simulated time. You can return to the normal city at any point.</p></aside></div>`;
}
