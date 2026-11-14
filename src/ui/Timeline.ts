import type { Tick } from "../contract/types";
export function timeline(history: Tick[], current: Tick | null) {
  const max = Math.max(0, ...history.map((t) => t.t));
  return `<label for="sim-seek">Replay · ${current ? `${String(Math.floor(current.hour)).padStart(2, "0")}:${String((current.t % 6) * 10).padStart(2, "0")}` : "00:00"} / 24h</label><input id="sim-seek" type="range" min="0" max="${max}" value="${current?.t ?? 0}" ${history.length ? "" : "disabled"}><div class="timeline-events">2h collapse · 8h surge · 9h feeder · 18h crash</div><svg viewBox="0 0 300 28" aria-label="Recorded supply"><polyline fill="none" stroke="#a8d4be" stroke-width="1.5" points="${history.map((t) => `${(t.t / 143) * 300},${27 - (t.supply / 210) * 26}`).join(" ")}"/></svg>`;
}
