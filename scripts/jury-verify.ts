import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const bytes = (file: string) => readFile(file);
const json = async (file: string) => JSON.parse((await bytes(file)).toString());
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
};
const run = (command: string, args: string[], env = process.env) => {
  try {
    return execFileSync(command, args, { encoding: "utf8", env, maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    const failed = error as { stderr?: Buffer | string; stdout?: Buffer | string };
    const detail = String(failed.stderr || failed.stdout || error).slice(-3000);
    throw new Error(`${command} ${args.join(" ")} failed:\n${detail}`);
  }
};

const protocolFile = "experiments/ml/revision_audit_protocol.json";
const policyFile = "experiments/ml/policy_revision_selected.json";
const datasetFile = "data/processed/electricity/ecl_10_hourly.csv";
const modelFile = "artifacts/xgboost/electricity_10_meter_3h.json";
const protocolBytes = await bytes(protocolFile);
const protocol = JSON.parse(protocolBytes.toString());
const policyBytes = await bytes(policyFile);
const policy = JSON.parse(policyBytes.toString()).selected;
check(sha(await bytes(datasetFile)) === protocol.processedDataSha256, "Processed dataset differs from frozen audit");
check(sha(await bytes(modelFile)) === protocol.savedModelSha256, "Model weights differ from frozen audit");
check(sha(policyBytes) === protocol.frozenPolicySha256, "Revised policy differs from frozen audit");
check(JSON.stringify(protocol.frozenPolicy) === JSON.stringify({
  supplyFraction: policy.supplyFraction, fillFraction: policy.fillFraction,
  bufferMultiplier: policy.bufferMultiplier, priorityBlend: policy.priorityBlend,
}), "Policy parameters differ from frozen audit");

const excluded = new Set<string>();
for (const source of protocol.priorSources as Array<{ file: string; sha256: string }>) {
  const sourceBytes = await bytes(source.file);
  check(sha(sourceBytes) === source.sha256, `Prior-date source changed: ${source.file}`);
  const data = JSON.parse(sourceBytes.toString());
  for (const episode of data.episodes ?? [data]) excluded.add(episode.origin);
}
check(protocol.dates.length === 30 && new Set(protocol.dates).size === 30 &&
  protocol.dates.every((date: string) => !excluded.has(date)), "Audit dates overlap prior selections");

const exampleDate = protocol.dates[0].slice(0, 10);
run("ml/.venv/bin/python", ["ml/infer_electricity.py", "--date", exampleDate]);
const activeReplay = await json("data/ml/browser_replay_v1.json");
const activeDate = activeReplay.origin.slice(0, 10);
if (activeDate !== exampleDate)
  run("ml/.venv/bin/python", ["ml/infer_electricity.py", "--date", activeDate]);
const activeInferenceFile = `experiments/ml/inference_revision_${activeDate}.json`;
const activeInference = await json(activeInferenceFile);
check(activeInference.modelSha256 === activeReplay.modelSha256 &&
  JSON.stringify(activeInference.policy) === JSON.stringify(activeReplay.policy) &&
  JSON.stringify(activeInference.forecastDemand) === JSON.stringify(activeReplay.forecastDemand) &&
  JSON.stringify(activeInference.actualDemand) === JSON.stringify(activeReplay.actualDemand),
  "Bundled browser replay differs from fresh saved-model inference");
run("ml/.venv/bin/python", ["ml/verify_weather.py"]);
run("ml/.venv/bin/python", ["ml/infer_weather.py", "--date", activeDate]);
const weatherFile = `experiments/ml/weather_inference_${activeDate}.json`;
const weatherInference = await json(weatherFile);
const weatherReplay = await json("data/ml/weather_browser_replay_v1.json");
check(weatherReplay.originPortugal.slice(0, 10) === activeDate &&
  JSON.stringify(weatherInference) === JSON.stringify(weatherReplay),
  "Bundled weather forecast differs from fresh saved-model inference");
run("ml/.venv/bin/python", ["ml/build_fresh_audit.py", "--revision"]);
run(process.execPath, ["--import", "tsx", "scripts/policy-experiment.ts", "revision"]);

const inferenceFile = `experiments/ml/inference_revision_${exampleDate}.json`;
const inference = await json(inferenceFile);
const replay = await json("experiments/ml/replay_revision_audit.json");
const audit = await json("experiments/ml/revision_audit_summary.json");
const first = replay.episodes[0];
check(replay.protocolSha256 === sha(protocolBytes) && audit.protocolSha256 === sha(protocolBytes),
  "Replay or audit does not match the frozen protocol");
check(audit.passAllCriteria && Object.values(audit.checks).every(Boolean), "Revised policy failed its frozen criteria");
check(inference.modelSha256 === protocol.savedModelSha256 && first.origin === inference.origin,
  "Saved-model inference differs from frozen audit episode");
for (const [tick, actual] of Object.entries(first.actualDemand) as Array<[string, Record<string, number>]>) {
  for (const [id, amount] of Object.entries(actual)) {
    check(amount === inference.actualDemand[tick][id], `Measured demand mismatch at ${tick}/${id}`);
    const raw = first.xgboostForecast[tick][id];
    const buffered = first.calibratedForecast[tick][id];
    const expected = Math.round((raw + policy.bufferMultiplier * (buffered - raw)) * 100) / 100;
    check(Math.abs(expected - inference.forecastDemand[tick][id]) < 0.001,
      `Saved-model forecast mismatch at ${tick}/${id}`);
  }
}
console.log(`Model, data, ${protocol.dates.length} dates, inference and policy audit verified.`);

run(process.execPath, ["--import", "tsx", "scripts/check-boundaries.ts"]);
run("npm", ["test"]);
run("npm", ["run", "build"]);
console.log("Engine boundaries, unit tests and production build passed.");

const port = 4174;
const previewUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview",
  "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore" });
let launchError: Error | undefined;
server.on("error", (error) => { launchError = error; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    if (server.exitCode !== null) throw new Error(`Preview exited with ${server.exitCode}`);
    try {
      const response = await fetch(previewUrl);
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for the local preview to bind. */ }
    await delay(100);
  }
  check(ready, "Production preview did not start on port 4174");
  run(process.execPath, ["--import", "tsx", "scripts/forecast-browser-smoke.ts"],
    { ...process.env, VIDYUT_PREVIEW_URL: previewUrl });
} finally {
  server.kill("SIGTERM");
}
console.log("Historical browser replay passed.");

const dataset = await json("data/processed/electricity/manifest.json");
try {
  const raw = await bytes("data/raw/electricity/electricity_load_diagrams_2011_2014.zip");
  check(sha(raw) === dataset.source_sha256, "Optional raw source archive does not match recorded checksum");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const forecastEvaluation = await json("experiments/ml/model_comparison.json");
check(forecastEvaluation.test_windows === 3456 && forecastEvaluation.per_horizon.length === 3,
  "Committed held-out model evaluation is incomplete");
const weatherEvaluation = await json("experiments/ml/weather_model_evaluation.json");
const weatherManifest = await json("data/processed/weather/manifest.json");
const report = {
  version: 1,
  result: "PASS",
  dataset: { source: dataset.source, sourceSha256: dataset.source_sha256,
    processedSha256: protocol.processedDataSha256, selectedMeters: dataset.selected_meters },
  model: { type: "XGBoost", savedWeights: modelFile, sha256: protocol.savedModelSha256 },
  heldOutModelEvaluation: { file: "experiments/ml/model_comparison.json",
    sha256: sha(await bytes("experiments/ml/model_comparison.json")),
    testWindows: forecastEvaluation.test_windows, perHorizonMetricsKw: forecastEvaluation.per_horizon },
  inference: { date: exampleDate, report: inferenceFile, reportSha256: sha(await bytes(inferenceFile)),
    perHorizonMaeKw: inference.metrics },
  activeBrowserInference: { date: activeDate, report: activeInferenceFile,
    reportSha256: sha(await bytes(activeInferenceFile)), matchedBundledReplay: true },
  weather: {
    source: weatherManifest.documentation, provider: weatherManifest.provider,
    license: weatherManifest.license, sourceSha256: weatherManifest.source_sha256,
    processedSha256: weatherEvaluation.processed_data_sha256,
    gridCell: weatherManifest.returned_grid_cell,
    modelWeights: Object.fromEntries(Object.entries(weatherEvaluation.targets).map(([name, target]) =>
      [name, (target as { model_sha256: string }).model_sha256])),
    testWindows: weatherEvaluation.split.test.windows,
    perHorizon: Object.fromEntries(Object.entries(weatherEvaluation.targets).map(([name, target]) =>
      [name, (target as { per_horizon: unknown }).per_horizon])),
    activeReport: weatherFile, activeReportSha256: sha(await bytes(weatherFile)),
  },
  policyAudit: { protocol: protocolFile, protocolSha256: sha(protocolBytes),
    report: "experiments/ml/revision_audit_summary.json", reportSha256: sha(await bytes("experiments/ml/revision_audit_summary.json")),
    dates: audit.episodeCount, selected: audit.selectedMetrics, former: audit.formerMetrics,
    staticPriority: audit.staticMetrics, pairedImprovement: audit.medianPairedPhlImprovement,
    lowerLossThanFormerDays: audit.selectedLowerPhlThanFormerDays,
    lowerLossThanStaticDays: audit.selectedLowerPhlThanStaticDays, criteria: audit.checks },
  checks: { dataAndWeights: true, priorDateExclusion: true, inferenceMatchesReplay: true,
    activeBrowserMatchesInference: true,
    savedWeatherModelEvaluation: true, weatherPastOnlyFeatures: true,
    activeWeatherMatchesInference: true,
    frozenPolicyAudit: true, engineBoundaries: true, unitTests: true, productionBuild: true,
    historicalBrowserReplay: true },
  demoVideo: { file: "docs/assets/ml-demo.webm", sha256: sha(await bytes("docs/assets/ml-demo.webm")) },
  limitations: ["Meters are anonymous customers mapped illustratively to utilities.",
    "Cyclone supply, feeder disruption and service impacts are simulated.",
    "ERA5 weather is reanalysis; rainfall XGBoost was weaker than simple baselines and weather does not drive the grid scenario.",
    "Policy-audit dates are unused for allocation replay but belong to the existing model test period.",
    "100% scripted-supply planning does not establish safety under uncertain real supply."],
};
await writeFile("experiments/ml/jury_evidence_manifest.json", JSON.stringify(report, null, 2) + "\n");
console.log("Wrote experiments/ml/jury_evidence_manifest.json (PASS).");
