import type { Tick } from "../contract/types";
export function escape(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function negotiationFeed(t: Tick | null) {
  if (!t) return "";
  return `<p>${t.negotiation.outcome.toUpperCase()} · hash ${t.negotiation.hash} · ${t.negotiation.messages.length} messages</p><ol class="message-feed">${t.negotiation.messages.map((m) => `<li class="${m.delivered ? "" : "message-dropped"}"><b>${m.type}</b> ${m.sender} → ${m.recipient} · ${m.phase ?? "agreement"} round ${m.round} / attempt ${m.attempt + 1}<small>${escape(m.reason)}${m.bid ? ` · demand ${m.bid.demand}, min ${m.bid.minimum}, value ${m.bid.value.toFixed(2)}` : ""}${m.allocation !== undefined ? ` · ${m.allocation.toFixed(2)} PU` : ""}${m.hash ? " · " + m.hash : ""}</small></li>`).join("")}</ol>`;
}
