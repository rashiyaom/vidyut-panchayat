import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = "experiments/ml/";
const path = `${root}revision_audit_protocol.json`;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
try {
  await readFile(path);
  throw new Error("Revision audit already frozen; refusing to replace its dates or criteria");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const firstSelection = await readFile(`${root}policy_selected.json`);
const candidates = JSON.parse(firstSelection.toString()).candidates as Array<{
  name: string; sha256: string; supplyFraction: number; fillFraction: number;
  bufferMultiplier: number; priorityBlend: number; medianFairness: number;
  medianHospitalMin: number; medianPhl: number;
}>;
// The stricter margin responds to the first audit's fairness miss. Only the
// original validation reports are used to choose the revised candidate.
const eligibleCandidates = candidates.filter((c) => c.medianFairness >= 0.98 && c.medianHospitalMin >= 0.8);
const selected = eligibleCandidates.sort((a, b) => a.medianPhl - b.medianPhl)[0];
if (!selected) throw new Error("No validation candidate satisfies the stricter margin");
const reportBytes = await readFile(`${root}${selected.name}.json`);
if (digest(reportBytes) !== selected.sha256 || !JSON.parse(reportBytes.toString()).allRunsSafe)
  throw new Error("Selected validation report changed or violated capacity checks");
const policyPath = `${root}policy_revision_selected.json`;
const policyBytes = Buffer.from(JSON.stringify({
  version: 1,
  selectionRule: "Lowest validation median service loss with fairness >=0.980, hospital minimum >=0.800, zero capacity violations",
  selected,
}, null, 2) + "\n");
await writeFile(policyPath, policyBytes);

const previousFiles = [
  "replay_episodes.json", "replay_confirmation.json", "replay_validation.json",
  "replay_2014-08-08.json", "replay_fresh_audit.json",
  "inference_2014-08-09.json", "inference_2014-09-15.json", "inference_2014-08-11.json",
];
const used = new Set<string>();
const priorSources = [];
for (const name of previousFiles) {
  const file = `${root}${name}`;
  const bytes = await readFile(file);
  const data = JSON.parse(bytes.toString());
  const dates = data.episodes?.map((e: { origin: string }) => e.origin) ?? [data.origin];
  dates.forEach((date: string) => used.add(date));
  priorSources.push({ file, sha256: digest(bytes), dateCount: dates.length });
}
const csv = await readFile("data/processed/electricity/ecl_10_hourly.csv");
const stamps = csv.toString().trimEnd().split("\n").slice(1).map((line) => line.slice(0, 19));
const testStart = stamps.length - Math.floor(stamps.length * 0.2);
const available = stamps.slice(testStart, -2).filter((stamp) => stamp.endsWith("00:00:00") && !used.has(stamp));
if (available.length < 30) throw new Error(`Only ${available.length} unused test midnights remain`);
const dates = Array.from({ length: 30 }, (_, i) => available[Math.floor((i + 0.5) * available.length / 30)]);
if (new Set(dates).size !== 30) throw new Error("Selected revision dates are duplicated");
const protocol = {
  version: 1,
  purpose: "Second policy audit after tightening validation fairness margin; no second-audit outcomes used for selection",
  testStart: stamps[testStart],
  dateRule: "30 evenly spaced ranks of remaining unused test midnights",
  eligibleCount: available.length,
  dates,
  priorSources,
  originalSelectionSha256: digest(firstSelection),
  selectedValidationSha256: selected.sha256,
  policySourceFile: policyPath,
  frozenPolicySha256: digest(policyBytes),
  frozenPolicy: {
    supplyFraction: selected.supplyFraction, fillFraction: selected.fillFraction,
    bufferMultiplier: selected.bufferMultiplier, priorityBlend: selected.priorityBlend,
  },
  processedDataSha256: digest(csv),
  savedModelSha256: digest(await readFile("artifacts/xgboost/electricity_10_meter_3h.json")),
  criteria: {
    allCapacityChecksPass: true, medianFairnessAtLeast: 0.97,
    medianHospitalMinAtLeast: 0.8, medianPairedServiceLossImprovementAbove: 0,
    lowerServiceLossThanOldCouncilOnAtLeastDays: 18,
  },
  comparisons: ["former 100% council", "revised council", "static priority"],
  limitation: "Dates are unused for allocation replays but belong to the existing model test period.",
};
await writeFile(path, JSON.stringify(protocol, null, 2) + "\n");
console.log(`Frozen ${selected.name} and ${dates.length} dates from ${available.length} unused test midnights.`);
