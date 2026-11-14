import type { Config, Tick } from "../contract/types";
import { escape } from "./NegotiationFeed";

const pct = (value: number) => Math.max(0, Math.min(100, value));
const clock = (tick: number) =>
  `${String(Math.floor(tick / 6)).padStart(2, "0")}:${String((tick % 6) * 10).padStart(2, "0")}`;

export function resultDashboard(
  t: Tick | null,
  config: Config,
  history: Tick[],
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
  const tierRows = [1, 2, 3]
    .map((tier) => {
      const group = agents.filter((a) => a.tier === tier);
      const mean = group.length
        ? group.reduce((s, a) => s + a.service, 0) / group.length
        : 0;
      return `<div class="result-tier"><b>Tier ${tier}</b><span><i style="width:${pct(mean * 100)}%"></i></span><strong>${Math.round(mean * 100)}%</strong><small>${group.length} utilities · average effective service</small></div>`;
    })
    .join("");
  return `<div class="result-heading"><small>COMMITTED DECISION · ${clock(t.t)} · TICK ${t.t}</small><h2>${t.negotiation.outcome === "fallback" ? "Safe fallback applied" : "The council’s collective result"}</h2><p>${t.negotiation.outcome === "fallback" ? "Agreement failed. The previous allocation was reduced to fit current limits." : "This is the applied allocation after validation, using the recorded simulation tick."}</p></div><div class="result-numbers"><div><small>Supply available</small><strong>${t.supply.toFixed(1)} <em>PU</em></strong></div><div><small>Power committed</small><strong>${allocated.toFixed(1)} <em>PU</em></strong></div><div><small>Safety violations</small><strong>${t.metrics.violations}</strong></div><div><small>Within-tier fairness</small><strong>${Math.round(t.metrics.fairness * 100)}%</strong></div></div><div class="result-panels"><article class="result-panel"><span class="section-kicker">01 / THE ELECTRICITY BALANCE</span><h3>How much power was available?</h3><p>All bars share the same PU scale. Requests can exceed supply; committed power is the delivered grid allocation.</p><div class="result-balance">${[
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
    )}</div><small>${Math.max(0, requested - allocated).toFixed(1)} PU of requests were not supplied by the grid in this tick. Backup can support service.</small></article><article class="result-panel"><span class="section-kicker">02 / WHAT PEOPLE EXPERIENCE</span><h3>Service by priority tier</h3><p>Average effective service includes backup and upstream dependencies. It is not the same as grid allocation.</p><div class="result-tiers">${tierRows}</div></article></div><article class="result-panel result-history"><span class="section-kicker">03 / RECORDED HISTORY</span><h3>Service loss over time</h3><p>Each bar is one completed ten-minute tick. Lower synthetic person-hours is better.</p><div class="history-chart" role="img" aria-label="Synthetic essential-service loss for ${recent.length} completed ticks">${recent.map((x) => `<div title="${clock(x.t)} · ${Math.round(x.metrics.phl).toLocaleString()} person-hours"><b>${Math.round(x.metrics.phl).toLocaleString()}</b><span><i style="height:${Math.max(4, pct((x.metrics.phl / Math.max(1, ...recent.map((y) => y.metrics.phl))) * 100))}%"></i></span><small>${clock(x.t)}</small></div>`).join("")}</div><p class="chart-note">${recent.length === 1 ? "The trend will grow as you advance the simulation." : `${recent.length} completed decisions on this branch.`} Synthetic exposures can overlap and are not casualty estimates.</p></article><article class="result-panel"><span class="section-kicker">04 / EACH UTILITY</span><h3>Requested, supplied and functioning</h3><p>Bar length is supplied power as a share of each utility's request. Service is the separate outcome measure.</p><div class="allocation-bars result-agent-bars">${agents
    .map((a) => {
      const label =
        config.profiles.agents.find((p) => p.id === a.id)?.label ?? a.id;
      return `<div><b>${escape(label)} <small>Tier ${a.tier}</small></b><span title="${a.allocated.toFixed(1)} of ${a.demand.toFixed(1)} PU"><i style="width:${pct((a.allocated / Math.max(0.01, a.demand)) * 100)}%"></i></span><small>${a.allocated.toFixed(1)} / ${a.demand.toFixed(1)} PU</small><strong class="service-chip ${a.service < 0.8 ? "is-low" : ""}">${Math.round(a.service * 100)}% service</strong></div>`;
    })
    .join(
      "",
    )}</div></article><p class="chart-note">Modelled harm: ${t.metrics.damage.toFixed(2)} · Agreement fingerprint: ${escape(t.negotiation.hash)} · Aborts this tick: ${t.negotiation.aborts}. These figures are simulation outputs, not field measurements.</p>`;
}
