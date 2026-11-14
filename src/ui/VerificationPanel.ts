import type { Verification } from "../contract/types";
import { number } from "./MetricsPanel";
export function verificationPanel(v: Verification | null) {
  return v
    ? `<b>${v.result} · ${v.planId}</b><table><thead><tr><th>Metric</th><th>Actual</th><th>p10–p90</th><th>Result</th></tr></thead><tbody>${v.checks.map((c) => `<tr><td>${c.metric}</td><td>${number(c.actual)}</td><td>${number(c.p10)}–${number(c.p90)}</td><td>${c.result}</td></tr>`).join("")}</tbody></table>`
    : "<p>Verification appears when the approved window ends.</p>";
}
