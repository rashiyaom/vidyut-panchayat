import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const path = "experiments/ml/fresh_policy_audit_protocol.json";
const priorFiles = [
  "experiments/ml/replay_episodes.json",
  "experiments/ml/replay_confirmation.json",
  "experiments/ml/replay_validation.json",
  "experiments/ml/replay_2014-08-08.json",
  "experiments/ml/inference_2014-08-09.json",
  "experiments/ml/inference_2014-09-15.json",
];
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
let existing: Buffer | undefined;
try { existing = await readFile(path); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
if (existing) throw new Error(`Audit protocol already frozen at ${path}; do not replace it after inspecting outcomes`);

const csv = await readFile("data/processed/electricity/ecl_10_hourly.csv");
const lines = csv.toString("utf8").trimEnd().split("\n");
const timestamps = lines.slice(1).map((line) => line.slice(0, 19));
const testStart = timestamps.length - Math.floor(timestamps.length * 0.2);
const prior = new Set<string>();
const priorSources = [];
for (const file of priorFiles) {
  const bytes = await readFile(file);
  const data = JSON.parse(bytes.toString());
  const dates = data.episodes?.map((episode: { origin: string }) => episode.origin) ?? [data.origin];
  for (const date of dates) prior.add(date);
  priorSources.push({ file, sha256: digest(bytes), dateCount: dates.length });
}
const eligible = timestamps.slice(testStart, -2)
  .filter((value) => value.endsWith("00:00:00") && !prior.has(value));
if (eligible.length < 30) throw new Error(`Only ${eligible.length} unused test midnights`);
const dates = Array.from({ length: 30 }, (_, i) => eligible[Math.floor((i + 0.5) * eligible.length / 30)]);
if (new Set(dates).size !== 30 || dates.some((date) => prior.has(date)))
  throw new Error("Audit dates are duplicated or previously inspected");
const selectedBytes = await readFile("experiments/ml/policy_selected.json");
const selected = JSON.parse(selectedBytes.toString()).selected;
const modelBytes = await readFile("artifacts/xgboost/electricity_10_meter_3h.json");
const protocol = {
  version: 1,
  purpose: "Fresh policy audit on 30 model-test dates unused by earlier allocation replays or the two manual inference demos",
  selection: "30 evenly spaced ranks from all eligible test midnights; index floor((i+0.5)*eligibleCount/30)",
  testStart: timestamps[testStart],
  eligibleCount: eligible.length,
  dates,
  priorSources,
  processedDataSha256: digest(csv),
  savedModelSha256: digest(modelBytes),
  frozenPolicySha256: digest(selectedBytes),
  frozenPolicy: {
    supplyFraction: selected.supplyFraction,
    fillFraction: selected.fillFraction,
    bufferMultiplier: selected.bufferMultiplier,
    priorityBlend: selected.priorityBlend,
  },
  criteria: {
    allCapacityChecksPass: true,
    medianFairnessAtLeast: 0.97,
    medianHospitalMinAtLeast: 0.8,
    medianPairedServiceLossImprovementAbove: 0,
    lowerServiceLossThanOldCouncilOnAtLeastDays: 18,
  },
  comparisons: ["former 100% council", "frozen selected policy", "static priority"],
  limitation: "These are unused allocation-replay dates from the existing model test period, not a newly collected dataset or a real cyclone.",
};
await writeFile(path, JSON.stringify(protocol, null, 2) + "\n");
console.log(`Frozen ${dates.length} unused dates from ${eligible.length} eligible test midnights in ${path}.`);
