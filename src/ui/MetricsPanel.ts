import type { Tick } from "../contract/types";
import { escape } from "./NegotiationFeed";
export const number = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 1 });
export function metricsPanel(t: Tick | null) {
  if (!t)
    return "<p>Agents are preparing the initial plan. Review the evidence below.</p>";
  const m = t.metrics;
  return `<div class="metric-grid"><div><small>Supply / demand</small><b>${number(t.supply)} / ${number(t.agents.reduce((s, a) => s + a.demand, 0))} PU</b></div>${t.gridLoad ? `<div><small>Measured Portugal load</small><b>${number(t.gridLoad.loadMw)} MW</b></div>` : ""}<div><small>Synthetic service loss</small><b>${number(m.phl)} person-h</b></div><div><small>Modelled harm</small><b>${m.damage.toFixed(2)}</b></div><div><small>Within-tier fairness</small><b>${(m.fairness * 100).toFixed(1)}%</b></div><div><small>Applied violations / blocked</small><b>${m.violations} / ${m.blocked}</b></div><div><small>Aborts / fallbacks</small><b>${m.aborts} / ${m.fallbacks}</b></div><div><small>Hospital minimum</small><b>${(m.hospitalMin * 100).toFixed(1)}%</b></div><div><small>Critical uptime</small><b>${(m.criticalUptime * 100).toFixed(1)}%</b></div></div><p class="council-note">${t.events.map(escape).join(" · ") || "10-minute interval"}${t.gridLoad ? ` · National load period ended ${escape(t.gridLoad.periodEndUtc)}; not feeder capacity` : ""}${t.negotiation.triage.length ? " · Triage: " + t.negotiation.triage.join(", ") : ""}</p>`;
}
