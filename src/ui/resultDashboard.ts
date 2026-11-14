import type { Config, Tick } from "../contract/types";
import { escape } from "./NegotiationFeed";
import { caseInfo, type CaseId } from "../contract/cases";
import replay from "../../data/ml/browser_replay_v1.json";
import weather from "../../data/ml/weather_browser_replay_v1.json";

const pct = (value: number) => Math.max(0, Math.min(100, value));
const clock = (tick: number) =>
  `${String(Math.floor(tick / 6)).padStart(2, "0")}:${String((tick % 6) * 10).padStart(2, "0")}`;

export function resultDashboard(
  t: Tick | null,
  config: Config,
  history: Tick[],
  activeCase: CaseId = "cyclone",
) {
  if (!t)
    return `<div class="result-empty"><span class="section-kicker">COLLECTIVE RESULT</span><h2>No decision has been committed yet.</h2><p>The council is preparing a plan. Review it in Your decision, approve it from the action bar, then advance ten minutes to see recorded simulation outputs here.</p></div>`;
  const agents = [...t.agents].sort(
    (a, b) => a.tier - b.tier || b.demand - a.demand,
  );
  const allocated = agents.reduce((s, a) => s + a.allocated, 0);
  const requested = agents.reduce((s, a) => s + a.demand, 0);
  const max = Math.max(t.supply, requested, allocated, 1);
  const recent = [...history].sort((a, b) => a.t - b.t).slice(-12);
  const allHistory = [...history].sort((a, b) => a.t - b.t);
  const lossRows = recent.map((item) => {
    const previous = allHistory.find((row) => row.t === item.t - 1);
    return {
      tick: item.t,
      loss: Math.max(0, item.metrics.phl - (previous?.metrics.phl ?? 0)),
    };
  });
  const peakLoss = Math.max(1, ...lossRows.map((row) => row.loss));
  const historicalEvidence =
    activeCase === "historical"
      ? `<article class="result-panel"><span class="section-kicker">10 / HISTORICAL INPUTS</span><h3>Where the real signals entered</h3><div class="result-method"><div><b>Electricity · held-out date ${escape(replay.origin.slice(0, 10))}</b><p>Ten anonymous UCI meter readings were forecast by a saved XGBoost model, then mapped to the ten simulated utility roles. They are not facility meters. Model SHA-256: <code>${escape(replay.modelSha256)}</code>.</p></div><div><b>Weather and grid</b><p>Wind and rainfall forecasts came from the saved weather replay for ${escape(weather.originPortugal.slice(0, 10))}. ${t.gridLoad ? `National load was ${t.gridLoad.loadMw.toFixed(0)} MW at this tick.` : "National load is not available at this tick."} Weather-to-grid stress is an illustrative rule; national load is not local supply.</p></div></div><p>The emergency schedule, utility identities, feeders and service impacts are authored. See the Real System page for training splits and full source artifacts.</p></article>`
      : "";
  const tierRows = [1, 2, 3]
    .map((tier) => {
      const group = agents.filter((a) => a.tier === tier);
      const mean = group.length
        ? group.reduce((s, a) => s + a.service, 0) / group.length
        : 0;
      return `<div class="result-tier"><b>Tier ${tier}</b><span><i style="width:${pct(mean * 100)}%"></i></span><strong>${Math.round(mean * 100)}%</strong><small>${group.length} utilities · average effective service</small></div>`;
    })
    .join("");
  return `<div class="result-heading"><small>COMMITTED DECISION · ${clock(t.t)} · TICK ${t.t}</small><h2>${t.negotiation.outcome === "fallback" ? "Safe fallback applied" : "The council’s collective result"}</h2><p>${t.negotiation.outcome === "fallback" ? "Agreement failed. The previous allocation was reduced to fit current limits." : "This is the applied allocation after validation, using the recorded simulation tick."}</p><button id="download-decision-pdf" type="button">↓ Download decision PDF</button></div><div class="result-numbers"><div><small>Supply available</small><strong>${t.supply.toFixed(1)} <em>PU</em></strong></div><div><small>Power committed</small><strong>${allocated.toFixed(1)} <em>PU</em></strong></div><div><small>Safety violations</small><strong>${t.metrics.violations}</strong></div><div><small>Within-tier fairness</small><strong>${Math.round(t.metrics.fairness * 100)}%</strong></div></div><div class="result-panels"><article class="result-panel"><span class="section-kicker">01 / THE ELECTRICITY BALANCE</span><h3>How much power was available?</h3><p>All bars share the same PU scale. Requests can exceed supply; committed power is the delivered grid allocation.</p><div class="result-balance">${[
    ["Requested", requested, "request"],
    ["Available", t.supply, "supply"],
    ["Committed", allocated, "committed"],
  ]
    .map(
      ([label, value, kind]) =>
        `<div><b>${label}</b><span><i class="${kind}" style="width:${pct((Number(value) / max) * 100)}%"></i></span><strong>${Number(value).toFixed(1)} PU</strong></div>`,
    )
    .join(
      "",
    )}</div><small>${Math.max(0, requested - allocated).toFixed(1)} PU of requests were not supplied by the grid in this tick. Backup can support service.</small></article><article class="result-panel"><span class="section-kicker">02 / WHAT PEOPLE EXPERIENCE</span><h3>Service by priority tier</h3><p>Average effective service includes backup and upstream dependencies. It is not the same as grid allocation.</p><div class="result-tiers">${tierRows}</div></article></div><article class="result-panel result-history"><span class="section-kicker">03 / RECORDED HISTORY</span><h3>Service loss per interval</h3><p>Each bar is the increase in synthetic person-hours during one completed ten-minute tick. Lower is better.</p><div class="history-chart" role="img" aria-label="Synthetic essential-service loss for ${recent.length} completed ticks">${lossRows.map((row) => `<div title="${clock(row.tick)} · ${Math.round(row.loss).toLocaleString()} person-hours"><b>${Math.round(row.loss).toLocaleString()}</b><span><i style="height:${Math.max(4, pct((row.loss / peakLoss) * 100))}%"></i></span><small>${clock(row.tick)}</small></div>`).join("")}</div><p class="chart-note">${recent.length === 1 ? "The trend will grow as you advance the simulation." : `${recent.length} completed decisions on this branch.`} Synthetic exposures can overlap and are not casualty estimates.</p></article><article class="result-panel"><span class="section-kicker">04 / EACH UTILITY</span><h3>Requested, supplied and functioning</h3><p>Bar length is supplied power as a share of each utility's request. Service is the separate outcome measure.</p><div class="allocation-bars result-agent-bars">${agents
    .map((a) => {
      const label =
        config.profiles.agents.find((p) => p.id === a.id)?.label ?? a.id;
      return `<div><b>${escape(label)} <small>Tier ${a.tier}</small></b><span title="${a.allocated.toFixed(1)} of ${a.demand.toFixed(1)} PU"><i style="width:${pct((a.allocated / Math.max(0.01, a.demand)) * 100)}%"></i></span><small>${a.allocated.toFixed(1)} / ${a.demand.toFixed(1)} PU</small><strong class="service-chip ${a.service < 0.8 ? "is-low" : ""}">${Math.round(a.service * 100)}% service</strong></div>`;
    })
    .join(
      "",
    )}</div></article><article class="result-panel"><span class="section-kicker">05 / HOW THE RESULT WAS REACHED</span><h3>From request to applied allocation</h3><div class="result-method"><div><b>1 · Demand</b><p>${requested.toFixed(1)} PU requested across ten utility profiles. ${activeCase === "historical" ? "Historical anonymous meter readings and saved forecasts are mapped to these simulated utility roles." : "Demands come from authored profiles and case events, with bounded simulation noise."}</p></div><div><b>2 · Physical limits</b><p>Clearing checks supply, three bus capacities and ten feeder capacities. Total available: ${t.supply.toFixed(1)} PU; ${t.constitution.ok ? "the committed allocation passed the constitution" : "the constitution reported a problem"}.</p></div><div><b>3 · Negotiation</b><p>${t.negotiation.messages.length} recorded agent protocol messages; ${t.negotiation.messages.filter((m) => !m.delivered).length} lost deliveries; ${t.negotiation.rounds} rounds. Outcome: ${escape(t.negotiation.outcome)}${t.negotiation.triage.length ? `; triage: ${t.negotiation.triage.map((id) => escape(id)).join(", ")}` : ""}.</p></div><div><b>4 · Service outcome</b><p>Backup, reserves and upstream dependencies turn grid allocation into effective service. Synthetic loss so far: ${Math.round(t.metrics.phl).toLocaleString()} person-hours; within-tier fairness: ${Math.round(t.metrics.fairness * 100)}%.</p></div></div></article><div class="result-panels"><article class="result-panel"><span class="section-kicker">06 / WATER AI</span><h3>Power for water service</h3>${serviceDetail("water", t, config)}<p>Water flow, pressure, quality, tank inventory and distribution volumes are not measured by this model. Any routing in the discussion remains a proposal.</p></article><article class="result-panel"><span class="section-kicker">07 / TELECOM AI</span><h3>Power for communications</h3>${serviceDetail("telecom", t, config)}<p>The engine records agent protocol delivery. It does not measure public mobile coverage, call completion or real network traffic.</p></article></div><article class="result-panel"><span class="section-kicker">08 / FULL ALLOCATION LEDGER</span><h3>What every AI was given</h3><div class="ledger-wrap"><table class="result-ledger"><thead><tr><th>Utility</th><th>Tier</th><th>Requested</th><th>Allocated</th><th>Grid gap</th><th>Backup</th><th>Effective service</th><th>Reserve</th><th>Status</th></tr></thead><tbody>${agents.map((a) => `<tr><th>${escape(config.profiles.agents.find((p) => p.id === a.id)?.label ?? a.id)}</th><td>${a.tier}</td><td>${a.demand.toFixed(2)} PU</td><td>${a.allocated.toFixed(2)} PU</td><td>${Math.max(0, a.demand - a.allocated).toFixed(2)} PU</td><td>${Math.round(a.backup * 100)}%</td><td>${Math.round(a.service * 100)}%</td><td>${a.reserveHours.toFixed(1)} h</td><td>${escape(a.status)}</td></tr>`).join("")}</tbody></table></div></article><article class="result-panel"><span class="section-kicker">09 / NETWORK AND PROVENANCE</span><h3>Constraints and source boundaries</h3><div class="ledger-wrap"><table class="result-ledger"><thead><tr><th>Electrical line</th><th>From → to</th><th>Flow</th><th>Capacity</th><th>Utilisation</th></tr></thead><tbody>${t.lines.map((line) => `<tr><th>${escape(line.id)}</th><td>${escape(line.from)} → ${escape(line.to)}</td><td>${line.flow.toFixed(2)} PU</td><td>${line.capacity.toFixed(2)} PU</td><td>${line.capacity ? Math.round((line.flow / line.capacity) * 100) : 0}%</td></tr>`).join("")}</tbody></table></div><p><b>Case:</b> ${escape(caseInfo(activeCase).title)} · ${escape(caseInfo(activeCase).source)}. ${t.gridLoad ? `Observed Portugal national load: ${t.gridLoad.loadMw.toFixed(0)} MW for period ending ${escape(t.gridLoad.periodEndUtc)}; this is not local available supply.` : "No measured grid telemetry is attached to this tick."} Local feeders, utility identities, service dependencies and emergency events are authored simulation inputs.</p><p>Agreement fingerprint: <code>${escape(t.negotiation.hash)}</code> · Seed ${config.seed} · Scenario ${escape(config.scenario.id)}. Modelled harm ${t.metrics.damage.toFixed(2)} is synthetic, not a casualty estimate.</p></article>${historicalEvidence}`;
}

function serviceDetail(id: "water" | "telecom", t: Tick, config: Config) {
  const a = t.agents.find((item) => item.id === id)!;
  const profile = config.profiles.agents.find((item) => item.id === id)!;
  return `<div class="service-detail-numbers"><div><small>Requested</small><strong>${a.demand.toFixed(1)} PU</strong></div><div><small>Allocated</small><strong>${a.allocated.toFixed(1)} PU</strong></div><div><small>Effective service</small><strong>${Math.round(a.service * 100)}%</strong></div><div><small>Reserve left</small><strong>${a.reserveHours.toFixed(1)} h</strong></div></div><p>Grid shortfall ${Math.max(0, a.demand - a.allocated).toFixed(1)} PU · backup contribution ${Math.round(a.backup * 100)}% · ${escape(a.status)}. ${profile.dependsOn.length ? `Depends on ${profile.dependsOn.map((dep) => escape(config.profiles.agents.find((item) => item.id === dep.agent)?.label ?? dep.agent)).join(", ")}.` : "No configured upstream service dependency."}</p>`;
}
