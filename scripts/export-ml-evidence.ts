import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const [forecast, confirmation, baseline, manifest, modelBytes] = await Promise.all([
  read("experiments/ml/model_comparison.json"),
  read("experiments/ml/confirmation_100.json"),
  read("experiments/ml/confirmation_085.json"),
  read("data/processed/electricity/manifest.json"),
  readFile("artifacts/xgboost/electricity_10_meter_3h.json"),
]);
if (confirmation.episodeCount !== 30 || baseline.episodeCount !== 30)
  throw new Error("Expected 30 confirmation episodes for both policy settings");
if (confirmation.supplyFraction !== 1 || baseline.supplyFraction !== 0.85 ||
    !confirmation.allRunsSafe || !baseline.allRunsSafe)
  throw new Error("Confirmation runs must be safe, paired 100% and 85% policies");
const rows: Array<{ date: string; council100: number; council85: number; previousDay: number; staticPriority: number }> = confirmation.episodes.map((episode: any, i: number) => {
  if (episode.origin !== baseline.episodes[i]?.origin)
    throw new Error(`Mismatched confirmation origin at row ${i}`);
  return {
    date: episode.origin.slice(0, 10),
    council100: Math.round(episode.calibrated.phl),
    council85: Math.round(baseline.episodes[i].calibrated.phl),
    previousDay: Math.round(episode.previousDay.phl),
    staticPriority: Math.round(episode.staticPriority.phl),
  };
});
const paired = confirmation.episodes.map((episode: any, i: number) =>
  baseline.episodes[i].calibrated.phl - episode.calibrated.phl,
).sort((a: number, b: number) => a - b);
const medianPairedImprovement = (paired[14] + paired[15]) / 2;
const evidence = {
  version: 1,
  model: "XGBoost demand forecast + validation-derived upper residual buffer",
  modelSha256: createHash("sha256").update(modelBytes).digest("hex"),
  dataSource: manifest.source,
  dataSha256: manifest.source_sha256,
  meterIds: manifest.selected_meters,
  forecastMetrics: forecast.per_horizon,
  policy: {
    validationCandidates: [0.85, 0.95, 1],
    selectedSupplyFraction: 1,
    confirmationDays: confirmation.episodeCount,
    medianPairedImprovementVs85: Math.round(medianPairedImprovement),
    betterThan85Days: rows.filter((r) => r.council100 < r.council85).length,
    betterThanStaticDays: confirmation.calibratedLowerPhlThanStatic,
    medianSyntheticServiceLoss: {
      council100: Math.round(confirmation.calibratedMedianPhl),
      staticPriority: Math.round(confirmation.staticMedianPhl),
    },
  },
  limitations: "Historical measurements are anonymous customers mapped illustratively to utilities. Cyclone supply and service impacts are simulated. The normal live city remains on its 85% supply rule.",
  rows,
};
await mkdir("data/ml", { recursive: true });
await writeFile("data/ml/evidence_v1.json", JSON.stringify(evidence, null, 2) + "\n");
console.log(`Exported ${rows.length} held-out decision rows and 3 forecast horizons. Active browser episode is set by ml:infer.`);
