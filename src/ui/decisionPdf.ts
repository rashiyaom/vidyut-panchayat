import type { Config, Tick } from "../contract/types";
import { caseInfo, type CaseId } from "../contract/cases";
import replay from "../../data/ml/browser_replay_v1.json";

const ink = "#183c31",
  muted = "#586c5e",
  green = "#3d8062",
  pale = "#edf2e9";
const ascii = (value: string) =>
  value.normalize("NFKD").replace(/[^\x20-\x7e]/g, "-");
const quote = (value: string) =>
  ascii(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
const color = (hex: string) =>
  [1, 3, 5]
    .map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3))
    .join(" ");
type Page = string[];
const rect = (
  page: Page,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
) => page.push(`${color(fill)} rg ${x} ${y} ${w} ${h} re f`);
const line = (
  page: Page,
  x: number,
  y: number,
  w: number,
  stroke = "#d9e2d6",
) => page.push(`${color(stroke)} RG 1 w ${x} ${y} m ${x + w} ${y} l S`);
const text = (
  page: Page,
  value: string,
  x: number,
  y: number,
  size = 10,
  bold = false,
  fill = ink,
) =>
  page.push(
    `BT /${bold ? "F2" : "F1"} ${size} Tf ${color(fill)} rg 1 0 0 1 ${x} ${y} Tm (${quote(value)}) Tj ET`,
  );
function wrap(
  page: Page,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 10,
  leading = 15,
  fill = muted,
) {
  let row = "";
  for (const word of ascii(value).split(/\s+/)) {
    if ((row + " " + word).length * size * 0.51 > width && row) {
      text(page, row, x, y, size, false, fill);
      y -= leading;
      row = word;
    } else row += `${row ? " " : ""}${word}`;
  }
  if (row) {
    text(page, row, x, y, size, false, fill);
    y -= leading;
  }
  return y;
}
function header(page: Page, pageNo: number, caseTitle: string) {
  rect(page, 0, 0, 595, 842, "#ffffff");
  rect(page, 0, 776, 595, 66, ink);
  text(page, "VIDYUT PANCHAYAT", 38, 813, 17, true, "#ffffff");
  text(
    page,
    "YOUTH PANCHAYAT COUNCIL  /  DECISION RECORD",
    38,
    793,
    8,
    false,
    "#c8ddca",
  );
  text(page, `CASE: ${caseTitle.toUpperCase()}`, 38, 757, 9, true);
  line(page, 38, 45, 519);
  text(
    page,
    "Simulation evidence - local operations are illustrative",
    38,
    29,
    8,
    false,
    muted,
  );
  text(page, `${pageNo} / 3`, 523, 29, 8, true, muted);
}
function section(page: Page, title: string, y: number) {
  text(page, title.toUpperCase(), 38, y, 10, true, green);
  line(page, 38, y - 9, 519);
  return y - 29;
}
function bar(
  page: Page,
  label: string,
  value: number,
  max: number,
  y: number,
  fill: string,
  unit = "PU",
) {
  text(page, label, 40, y + 3, 10, true);
  rect(page, 160, y, 298, 12, pale);
  rect(
    page,
    160,
    y,
    Math.max(1, 298 * Math.min(1, value / Math.max(1, max))),
    12,
    fill,
  );
  text(page, `${value.toFixed(1)} ${unit}`, 468, y + 2, 9, true);
}
export function decisionPdfBytes(
  tick: Tick,
  config: Config,
  activeCase: CaseId,
  history: Tick[],
): Uint8Array {
  const title = caseInfo(activeCase).title;
  const pages: Page[] = [[], [], []];
  pages.forEach((page, index) => header(page, index + 1, title));
  const agents = [...tick.agents].sort(
    (a, b) => a.tier - b.tier || b.demand - a.demand,
  );
  const demand = agents.reduce((sum, a) => sum + a.demand, 0);
  const allocated = agents.reduce((sum, a) => sum + a.allocated, 0);
  const max = Math.max(demand, tick.supply, allocated);
  const p1 = pages[0];
  text(p1, `Collective decision - tick ${tick.t}`, 38, 712, 22, true);
  wrap(
    p1,
    `Outcome ${tick.negotiation.outcome}; ${tick.negotiation.messages.length} recorded agent messages; ${tick.negotiation.aborts} aborts. The numbers below are the applied simulation result, not field measurements.`,
    38,
    688,
    519,
  );
  let y = section(p1, "Electricity balance", 630);
  bar(p1, "Requested", demand, max, y, "#bda176");
  y -= 30;
  bar(p1, "Available", tick.supply, max, y, "#7ca8b5");
  y -= 30;
  bar(p1, "Committed", allocated, max, y, green);
  y -= 40;
  y = wrap(
    p1,
    `${Math.max(0, demand - allocated).toFixed(1)} PU requested but not supplied by the grid. Backup may support effective service. Safety violations: ${tick.metrics.violations}; within-tier fairness: ${(tick.metrics.fairness * 100).toFixed(0)}%.`,
    38,
    y,
    519,
  );
  y = section(p1, "Effective service by priority tier", y - 20);
  for (const tier of [1, 2, 3]) {
    const group = agents.filter((a) => a.tier === tier);
    const average = group.reduce((sum, a) => sum + a.service, 0) / group.length;
    bar(p1, `Tier ${tier}`, average * 100, 100, y, green, "%");
    y -= 30;
  }
  y = section(p1, "Evidence and interpretation", y - 14);
  y = wrap(
    p1,
    activeCase === "historical"
      ? "Held-out anonymous meter demand and trained forecasts are mapped into simulated utility roles. Historical weather and Portugal national load are attached to this replay. The network, emergency and service effects are authored."
      : "Demand, utility roles, network and emergency events are authored simulation inputs. The negotiation engine produces the allocation and service model produces the reported outcomes.",
    38,
    y,
    519,
  );
  if (tick.gridLoad)
    y = wrap(
      p1,
      `Observed Portugal national load: ${tick.gridLoad.loadMw.toFixed(0)} MW, period ending ${tick.gridLoad.periodEndUtc}. This is not local available supply.`,
      38,
      y - 7,
      519,
    );
  const notesEnd = wrap(
    p1,
    `Cumulative synthetic service loss: ${Math.round(tick.metrics.phl)} person-hours. These exposures may overlap and are not casualty counts. Fingerprint: ${tick.negotiation.hash}.`,
    38,
    y - 14,
    519,
  );
  const chartTop = Math.min(174, notesEnd - 15);
  section(p1, "Service loss by ten-minute interval", chartTop);
  const ordered = [...history].sort((a, b) => a.t - b.t);
  const last = ordered.slice(-12);
  const losses = last.map((item) => ({
    tick: item.t,
    loss: Math.max(
      0,
      item.metrics.phl -
        (ordered.find((row) => row.t === item.t - 1)?.metrics.phl ?? 0),
    ),
  }));
  const peak = Math.max(1, ...losses.map((row) => row.loss));
  for (const [index, item] of losses.entries()) {
    const width = Math.min(35, 500 / Math.max(1, losses.length) - 7);
    const x = 43 + index * (width + 7);
    const height = Math.max(2, (58 * item.loss) / peak);
    rect(p1, x, 78, width, height, green);
    text(p1, String(item.tick), x, 65, 7, false, muted);
  }
  if (!losses.length) text(p1, "No completed interval recorded.", 38, 95, 9);

  const p2 = pages[1];
  text(p2, "Full utility allocation ledger", 38, 714, 21, true);
  text(
    p2,
    "All values are from the committed tick. PU is a simulation unit.",
    38,
    694,
    9,
    false,
    muted,
  );
  rect(p2, 38, 655, 519, 24, ink);
  [
    ["UTILITY", 45],
    ["TIER", 166],
    ["REQ", 204],
    ["GIVEN", 252],
    ["GAP", 307],
    ["SERVICE", 359],
    ["RESERVE", 422],
    ["STATUS", 488],
  ].forEach(([label, x]) =>
    text(p2, String(label), Number(x), 663, 8, true, "#ffffff"),
  );
  let rowY = 633;
  for (const a of agents) {
    if (agents.indexOf(a) % 2 === 0) rect(p2, 38, rowY - 5, 519, 25, pale);
    const label =
      config.profiles.agents.find((p) => p.id === a.id)?.label ?? a.id;
    [
      [label, 45],
      [String(a.tier), 169],
      [a.demand.toFixed(1), 204],
      [a.allocated.toFixed(1), 252],
      [Math.max(0, a.demand - a.allocated).toFixed(1), 307],
      [`${Math.round(a.service * 100)}%`, 359],
      [`${a.reserveHours.toFixed(1)} h`, 422],
      [a.status, 488],
    ].forEach(([value, x]) =>
      text(p2, String(value), Number(x), rowY + 3, 8, false),
    );
    rowY -= 27;
  }
  rowY = section(p2, "Water and telecom", rowY - 12);
  for (const id of ["water", "telecom"] as const) {
    const a = tick.agents.find((item) => item.id === id)!;
    text(p2, `${id.toUpperCase()} AI`, 38, rowY, 11, true);
    rowY = wrap(
      p2,
      `${a.allocated.toFixed(1)} / ${a.demand.toFixed(1)} PU allocated; ${Math.round(a.service * 100)}% effective service; ${Math.round(a.backup * 100)}% backup contribution; ${a.reserveHours.toFixed(1)} h reserve; status ${a.status}.`,
      38,
      rowY - 17,
      519,
    );
    rowY -= 13;
  }
  wrap(
    p2,
    "Water volumes, pipe pressure, public telecom coverage and emergency operations are not measured. Discussion actions are proposals.",
    38,
    rowY,
    519,
  );

  const p3 = pages[2];
  text(p3, "Constraints and audit trail", 38, 714, 21, true);
  let traceY = section(p3, "Electrical lines", 682);
  text(p3, "LINE", 45, traceY, 8, true);
  text(p3, "FROM > TO", 205, traceY, 8, true);
  text(p3, "FLOW", 414, traceY, 8, true);
  text(p3, "CAP", 487, traceY, 8, true);
  traceY -= 20;
  for (const item of tick.lines) {
    text(p3, item.id, 45, traceY, 8);
    text(p3, `${item.from} > ${item.to}`, 205, traceY, 8);
    text(p3, item.flow.toFixed(1), 414, traceY, 8);
    text(p3, item.capacity.toFixed(1), 487, traceY, 8);
    traceY -= 20;
  }
  traceY = section(p3, "How this decision was calculated", traceY - 17);
  const steps = [
    `1. Demand: ${demand.toFixed(1)} PU across ten utility profiles; case events and forecast inputs affect requests.`,
    `2. Constraints: supply ${tick.supply.toFixed(1)} PU plus bus and feeder capacities. Constitution ${tick.constitution.ok ? "passed" : "failed"}.`,
    `3. Negotiation: ${tick.negotiation.rounds} rounds; ${tick.negotiation.messages.filter((m) => !m.delivered).length} lost message deliveries; outcome ${tick.negotiation.outcome}.`,
    `4. Service: backup and upstream dependencies turn allocated power into effective service.`,
    `5. Trend: ${history.length} committed ticks on this branch; service loss metric is cumulative, so interval change is the difference between consecutive ticks.`,
  ];
  for (const step of steps) traceY = wrap(p3, step, 38, traceY, 519, 9, 13) - 6;
  traceY = section(p3, "Source boundary", traceY - 4);
  wrap(
    p3,
    `${caseInfo(activeCase).source}. ${activeCase === "historical" ? `Held-out date ${replay.origin.slice(0, 10)}; XGBoost model SHA-256 ${replay.modelSha256}.` : ""} Scenario ${config.scenario.id}; seed ${config.seed}. Local electrical capacities, service dependencies, utility identities and impacts are simulated. This report is a reproducible record of the selected branch and tick.`,
    38,
    traceY,
    519,
    9,
    13,
  );

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  for (let i = 0; i < pages.length; i++) {
    const stream = pages[i].join("\n") + "\n";
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
export function downloadDecisionPdf(
  tick: Tick,
  config: Config,
  activeCase: CaseId,
  history: Tick[],
) {
  const blob = new Blob(
    [decisionPdfBytes(tick, config, activeCase, history) as BlobPart],
    { type: "application/pdf" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `vidyut-panchayat-${activeCase}-tick-${tick.t}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
