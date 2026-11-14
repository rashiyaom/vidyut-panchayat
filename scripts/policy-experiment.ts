import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const mode = process.argv[2];
const selectedPath = "experiments/ml/policy_selected.json";
const validationCandidates = [
  { name: "validation_100", fill: 0, buffer: 1, blend: 0 },
  { name: "topup_validation_050", fill: 0.5, buffer: 1, blend: 0 },
  { name: "topup_validation_100", fill: 1, buffer: 1, blend: 0 },
  { name: "buffer_validation_150", fill: 1, buffer: 1.5, blend: 0 },
  { name: "buffer_validation_200", fill: 1, buffer: 2, blend: 0 },
  { name: "buffer_validation_300", fill: 1, buffer: 3, blend: 0 },
  { name: "blend_validation_025", fill: 1, buffer: 2, blend: 0.25 },
  { name: "blend_validation_035", fill: 1, buffer: 2, blend: 0.35 },
  { name: "blend_validation_040", fill: 1, buffer: 2, blend: 0.4 },
  { name: "blend_validation_043", fill: 1, buffer: 2, blend: 0.43 },
  { name: "blend_validation_045", fill: 1, buffer: 2, blend: 0.45 },
  { name: "blend_validation_050", fill: 1, buffer: 2, blend: 0.5 },
  { name: "blend_validation_075", fill: 1, buffer: 2, blend: 0.75 },
  { name: "blend_validation_100", fill: 1, buffer: 2, blend: 1 },
  { name: "blend_validation_150_025", fill: 1, buffer: 1.5, blend: 0.25 },
];
type Episode = { origin: string; calibrated: { phl: number; fairness: number; hospitalMin: number; violations: number }; staticPriority: { phl: number } };
type Replay = { episodeCount: number; allRunsSafe: boolean; supplyFraction: number; fillFraction?: number; bufferMultiplier?: number; priorityBlend?: number; episodes: Episode[] };
const median = (items: number[]) => {
  const sorted = items.slice().sort((a, b) => a - b);
  return (sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2;
};
const load = async (path: string): Promise<{ data: Replay; sha256: string }> => {
  const bytes = await readFile(path);
  return { data: JSON.parse(bytes.toString()) as Replay, sha256: createHash("sha256").update(bytes).digest("hex") };
};
const metrics = (data: Replay) => ({
  medianPhl: median(data.episodes.map((e) => e.calibrated.phl)),
  medianFairness: median(data.episodes.map((e) => e.calibrated.fairness)),
  medianHospitalMin: median(data.episodes.map((e) => e.calibrated.hospitalMin)),
  lowerPhlThanStaticDays: data.episodes.filter((e) => e.calibrated.phl < e.staticPriority.phl).length,
});

if (mode === "validate") {
  for (const candidate of validationCandidates.slice(1)) {
    execFileSync(process.execPath, ["--import", "tsx", "scripts/forecast-replay.ts",
      "experiments/ml/replay_validation.json", "1", `experiments/ml/${candidate.name}.json`,
      String(candidate.fill), String(candidate.buffer), String(candidate.blend)], { stdio: "pipe" });
  }
  console.log(`Regenerated ${validationCandidates.length - 1} policy candidate reports; the original 100% council validation remains the reference.`);
} else if (mode === "select") {
  const candidates = [];
  let origins: string[] | undefined;
  for (const spec of validationCandidates) {
    const name = spec.name;
    const { data, sha256 } = await load(`experiments/ml/${name}.json`);
    const dates = data.episodes.map((e) => e.origin);
    if (data.episodeCount !== 20 || dates.length !== 20 || !data.allRunsSafe ||
        data.supplyFraction !== 1 || (data.fillFraction ?? 0) !== spec.fill ||
        (data.bufferMultiplier ?? 1) !== spec.buffer || (data.priorityBlend ?? 0) !== spec.blend ||
        (origins && JSON.stringify(dates) !== JSON.stringify(origins)))
      throw new Error(`Invalid or unpaired validation report: ${name}`);
    origins = dates;
    const values = metrics(data);
    candidates.push({ name, sha256, supplyFraction: data.supplyFraction,
      fillFraction: data.fillFraction ?? 0, bufferMultiplier: data.bufferMultiplier ?? 1,
      priorityBlend: data.priorityBlend ?? 0, ...values,
      eligible: values.medianFairness >= 0.97 && values.medianHospitalMin >= 0.80 });
  }
  const winner = candidates.filter((c) => c.eligible).sort((a, b) => a.medianPhl - b.medianPhl)[0];
  if (!winner) throw new Error("No validation candidate met the service guardrails");
  const frozen = {
    version: 1,
    selectionData: "20 validation episodes; confirmation not read by this mode",
    objective: "lowest median synthetic service-loss person-hours",
    constraints: { allRunsSafe: true, medianFairnessAtLeast: 0.97, medianHospitalMinAtLeast: 0.80 },
    selected: winner,
    candidates,
  };
  await writeFile(selectedPath, JSON.stringify(frozen, null, 2) + "\n");
  console.log(`Selected ${winner.name}: PHL ${winner.medianPhl.toFixed(0)}, fairness ${winner.medianFairness.toFixed(4)}, hospital ${winner.medianHospitalMin.toFixed(4)}.`);
} else if (mode === "confirm") {
  const frozen = JSON.parse(await readFile(selectedPath, "utf8"));
  const selected = frozen.selected as { name: string; sha256: string; supplyFraction: number; fillFraction: number; bufferMultiplier: number; priorityBlend: number };
  const validation = await load(`experiments/ml/${selected.name}.json`);
  if (validation.sha256 !== selected.sha256)
    throw new Error("Frozen validation report checksum changed after selection");
  const path = "experiments/ml/policy_confirmation.json";
  execFileSync(process.execPath, ["--import", "tsx", "scripts/forecast-replay.ts",
    "experiments/ml/replay_confirmation.json", String(selected.supplyFraction), path,
    String(selected.fillFraction), String(selected.bufferMultiplier), String(selected.priorityBlend)],
    { stdio: "pipe" });
  const { data } = await load(path);
  const baseline = (await load("experiments/ml/confirmation_100.json")).data;
  if (data.episodeCount !== 30 || baseline.episodeCount !== 30 || !data.allRunsSafe ||
      data.episodes.some((e, i) => e.origin !== baseline.episodes[i].origin))
    throw new Error("Confirmation episodes differ or violate capacity checks");
  const paired = data.episodes.map((e, i) => baseline.episodes[i].calibrated.phl - e.calibrated.phl);
  const selectedMetrics = metrics(data);
  const baselineMetrics = metrics(baseline);
  const summary = {
    version: 1, selected: frozen.selected, episodeCount: 30,
    selectedMetrics, baselineMetrics,
    medianPairedPhlImprovement: median(paired),
    betterThanOldCouncilDays: paired.filter((v) => v > 0).length,
    betterThanStaticDays: selectedMetrics.lowerPhlThanStaticDays,
    staticMedianPhl: median(data.episodes.map((e) => e.staticPriority.phl)),
    allRunsSafe: data.allRunsSafe,
    limitation: "Actual customer meters are mapped illustratively to utilities; cyclone supply and service outcomes are simulated.",
  };
  await writeFile("experiments/ml/policy_confirmation_summary.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
} else {
  throw new Error("Usage: node --import tsx scripts/policy-experiment.ts validate|select|confirm");
}
