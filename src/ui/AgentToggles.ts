import type { Config, Tick } from "../contract/types";
export function agentToggles(config: Config, tick: Tick | null) {
  return `<p class="council-note">Disabled agents draw unmanaged demand first, clipped to grid limits. Synthetic modelling assumption.</p><table><thead><tr><th>Agent</th><th>PU / demand</th><th>Service</th><th>Reserve</th></tr></thead><tbody>${config.profiles.agents
    .map((p) => {
      const a = tick?.agents.find((a) => a.id === p.id);
      return `<tr><td><label><input type="checkbox" data-agent="${p.id}" ${config.enabledAgents.includes(p.id) ? "checked" : ""}>${p.label}${a?.isDown ? " HOLD" : ""}</label></td><td>${a ? `${a.allocated.toFixed(1)} / ${a.demand.toFixed(1)}` : "—"}</td><td>${a ? `${(a.service * 100).toFixed(0)}% ${a.status}` : "—"}</td><td>${a ? a.reserveHours.toFixed(2) + "h" : "—"}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}
