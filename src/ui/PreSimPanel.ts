import type { PreSimResult } from "../contract/types";
import { number } from "./MetricsPanel";
export function preSimPanel(r: PreSimResult | null) {
  if (!r) return "<p>30 futures run inside the worker before approval.</p>";
  return `<p>${r.nFutures} seeded futures · bounds / median / p10–p90</p><table><thead><tr><th>Metric</th><th>Median</th><th>p10–p90</th><th>Min–max</th></tr></thead><tbody>${Object.entries(
    r.plan,
  )
    .map(
      ([name, d]) =>
        `<tr><td>${name}</td><td>${number(d.p50)}</td><td>${number(d.p10)}–${number(d.p90)}</td><td>${number(d.min)}–${number(d.max)}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table><p>PHL forecast by tick · p10–p90 band / p50 line</p><canvas id="presim-fan" width="320" height="120" aria-label="Synthetic PHL forecast over the approved horizon"></canvas><p>Horizon PHL versus baselines</p><canvas id="presim-chart" width="320" height="100" aria-label="PHL future distributions"></canvas><ul>${r.guardrails.map((g) => `<li>${g.pass ? "✓" : "✕"} ${g.name}</li>`).join("")}</ul><p>${r.autoApproved ? "Auto guardrails passed" : "Human review required: guardrails did not all pass"}</p>`;
}
export function drawPreSim(
  canvas: HTMLCanvasElement | null,
  r: PreSimResult | null,
) {
  if (!canvas || !r) return;
  const ctx = canvas.getContext("2d")!;
  const rows = [
      { name: "Plan", d: r.plan.phl },
      ...r.baselines.map((b) => ({ name: b.strategy, d: b.evidence.phl })),
    ],
    max = Math.max(1, ...rows.map((r) => r.d.max));
  ctx.clearRect(0, 0, 320, 100);
  rows.forEach((row, i) => {
    const x = (v: number) => 80 + (v / max) * 230,
      y = 12 + i * 24;
    ctx.fillStyle = "#c1d9cd";
    ctx.font = "11px sans-serif";
    ctx.fillText(row.name, 0, y + 4);
    ctx.fillStyle = "#73c5a066";
    ctx.fillRect(
      x(row.d.p10),
      y - 6,
      Math.max(2, x(row.d.p90) - x(row.d.p10)),
      12,
    );
    ctx.fillStyle = "#f2d994";
    ctx.fillRect(x(row.d.p50), y - 8, 2, 16);
  });
}

export function drawFan(
  canvas: HTMLCanvasElement | null,
  r: PreSimResult | null,
) {
  if (!canvas || !r || !r.fan.length) return;
  const ctx = canvas.getContext("2d")!,
    max = Math.max(1, ...r.fan.map((p) => p.phl.max));
  const x = (i: number) => 10 + (i / Math.max(1, r.fan.length - 1)) * 300,
    y = (v: number) => 100 - (v / max) * 88;
  ctx.clearRect(0, 0, 320, 120);
  ctx.fillStyle = "#83cbae55";
  ctx.beginPath();
  r.fan.forEach((p, i) => {
    if (i) ctx.lineTo(x(i), y(p.phl.p90));
    else ctx.moveTo(x(i), y(p.phl.p90));
  });
  for (let i = r.fan.length - 1; i >= 0; i--)
    ctx.lineTo(x(i), y(r.fan[i].phl.p10));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#f2d994";
  ctx.lineWidth = 2;
  ctx.beginPath();
  r.fan.forEach((p, i) => {
    if (i) ctx.lineTo(x(i), y(p.phl.p50));
    else ctx.moveTo(x(i), y(p.phl.p50));
  });
  ctx.stroke();
  ctx.fillStyle = "#bfd0c8";
  ctx.font = "10px sans-serif";
  ctx.fillText(`Tick ${r.fan[0].tick}`, 10, 116);
  ctx.fillText(`Tick ${r.fan.at(-1)!.tick}`, 260, 116);
  ctx.fillText(number(max) + " person-h", 12, 10);
}
