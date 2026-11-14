import { mkdir, readFile, writeFile } from "node:fs/promises";
import profiles from "../data/agents/profiles.json";
import network from "../data/network/electrical_v1.json";
import scenario from "../data/scenarios/cyclone_24h.json";
import { configSchema } from "../src/contract/schemas";
import type { Allocation, Tick } from "../src/contract/types";
import { initialWorld, step, type World } from "../src/engine/world";
import { createPlan } from "../src/engine/planning/planner";
import { windowMetrics } from "../src/engine/metrics/scoring";

type Series = Record<string, Allocation>;
interface Episode {
  origin: string;
  actualDemand: Series;
  xgboostForecast: Series;
  calibratedForecast: Series;
  previousDayForecast: Series;
}
const replayFile = process.argv[2] ?? "experiments/ml/replay_episodes.json";
const supplyFraction = Number(process.argv[3] ?? 0.85);
const reportFile = process.argv[4] ?? "experiments/ml/allocation_replay.json";
const fillFraction = Number(process.argv[5] ?? 0);
const bufferMultiplier = Number(process.argv[6] ?? 1);
const priorityBlend = Number(process.argv[7] ?? 0);
if (!Number.isFinite(supplyFraction) || supplyFraction < 0.85 || supplyFraction > 1)
  throw new Error("Supply fraction must be between 0.85 and 1");
if (!Number.isFinite(fillFraction) || fillFraction < 0 || fillFraction > 1)
  throw new Error("Top-up fraction must be between 0 and 1");
if (!Number.isFinite(bufferMultiplier) || bufferMultiplier < 0 || bufferMultiplier > 3)
  throw new Error("Forecast buffer multiplier must be between 0 and 3");
if (!Number.isFinite(priorityBlend) || priorityBlend < 0 || priorityBlend > 1)
  throw new Error("Priority blend must be between 0 and 1");
const replay = JSON.parse(await readFile(replayFile, "utf8")) as {
  mapping: string;
  selection: string;
  episodes: Episode[];
};
const config = configSchema.parse({
  version: 1,
  seed: 42,
  strategy: "council",
  profiles,
  network,
  scenario: { ...scenario, demandNoise: 0, dropRate: 0, timingJitter: 0 },
  enabledAgents: profiles.agents.map((p) => p.id),
});
function run(episode: Episode, forecast: Series | undefined, strategy: "council" | "static" = "council") {
  let world: World = initialWorld({ ...config, strategy });
  world.observedDemand = episode.actualDemand;
  world.forecastDemand = forecast;
  if (strategy === "council") world.planSupplyFraction = supplyFraction;
  if (strategy === "council") world.planFillFraction = fillFraction;
  if (strategy === "council") world.planPriorityBlend = priorityBlend;
  const plan = strategy === "council" ? createPlan(world, 18) : undefined;
  if (plan && !plan.constitution.ok) throw new Error(plan.constitution.errors.join("; "));
  const ticks: Tick[] = [];
  for (let t = 0; t < 18; t++) {
    const result = step(world, plan);
    world = result.world;
    ticks.push(result.tick);
  }
  const unservedPUHours = ticks.reduce((sum, tick) =>
    sum + tick.agents.reduce((s, a) => s + Math.max(0, a.demand - a.allocated) / 6, 0), 0);
  const unusedSupplyPUHours = ticks.reduce((sum, tick) =>
    sum + Math.max(0, tick.supply - tick.agents.reduce((s, a) => s + a.allocated, 0)) / 6, 0);
  const tickDiagnostics = ticks.map((tick) => {
    const allocated = tick.agents.reduce((s, a) => s + a.allocated, 0);
    const unmetDemand = tick.agents.reduce((s, a) => s + Math.max(0, a.demand - a.allocated), 0);
    const unusedSupply = Math.max(0, tick.supply - allocated);
    return { tick: tick.t, supply: tick.supply, allocated, unmetDemand,
      unusedSupply, rootHeadroomWithUnmetDemand: Math.min(unusedSupply, unmetDemand),
      outcome: tick.negotiation.outcome };
  });
  return { plan, metrics: windowMetrics(ticks), unservedPUHours, unusedSupplyPUHours, tickDiagnostics };
}
const episodes = replay.episodes.map((episode) => {
  const xgboost = run(episode, episode.xgboostForecast);
  const adjustedForecast = Object.fromEntries(Object.entries(episode.calibratedForecast).map(([tick, allocation]) => [
    tick,
    Object.fromEntries(Object.keys(allocation).map((id) => {
      const key = id as keyof Allocation;
      const raw = episode.xgboostForecast[tick][key];
      return [id, Math.max(0, Math.round((raw + (allocation[key] - raw) * bufferMultiplier) * 100) / 100)];
    })) as Allocation,
  ])) as Series;
  const calibrated = run(episode, adjustedForecast);
  const previousDay = run(episode, episode.previousDayForecast);
  const staticPriority = run(episode, undefined, "static");
  const decisionsDifferent = xgboost.plan!.blocks.some((b, i) =>
    Object.keys(b.allocations).some((id) =>
      b.allocations[id as keyof Allocation] !== previousDay.plan!.blocks[i].allocations[id as keyof Allocation],
    ),
  );
  return {
    origin: episode.origin,
    decisionsDifferent,
    xgboost: xgboost.metrics,
    calibrated: calibrated.metrics,
    previousDay: previousDay.metrics,
    staticPriority: staticPriority.metrics,
    tickDiagnostics: { calibrated: calibrated.tickDiagnostics, staticPriority: staticPriority.tickDiagnostics },
    unservedPUHours: {
      xgboost: xgboost.unservedPUHours,
      calibrated: calibrated.unservedPUHours,
      previousDay: previousDay.unservedPUHours,
      staticPriority: staticPriority.unservedPUHours,
    },
    unusedSupplyPUHours: {
      calibrated: calibrated.unusedSupplyPUHours,
      previousDay: previousDay.unusedSupplyPUHours,
      staticPriority: staticPriority.unusedSupplyPUHours,
    },
    phlDifference: xgboost.metrics.phl - previousDay.metrics.phl,
    damageDifference: xgboost.metrics.damage - previousDay.metrics.damage,
    calibratedPhlDifference: calibrated.metrics.phl - previousDay.metrics.phl,
    calibratedVsRawPhlDifference: calibrated.metrics.phl - xgboost.metrics.phl,
  };
});
const median = (values: number[]) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
};
const report = {
  supplyFraction,
  fillFraction,
  bufferMultiplier,
  priorityBlend,
  mapping: replay.mapping,
  selection: replay.selection,
  scenario: "same authored cyclone supply schedule, actual demand, and seed for each pair",
  episodeCount: episodes.length,
  differentPlans: episodes.filter((e) => e.decisionsDifferent).length,
  xgboostLowerPhl: episodes.filter((e) => e.phlDifference < 0).length,
  xgboostHigherPhl: episodes.filter((e) => e.phlDifference > 0).length,
  calibratedLowerPhl: episodes.filter((e) => e.calibratedPhlDifference < 0).length,
  calibratedHigherPhl: episodes.filter((e) => e.calibratedPhlDifference > 0).length,
  xgboostMedianPhl: median(episodes.map((e) => e.xgboost.phl)),
  previousDayMedianPhl: median(episodes.map((e) => e.previousDay.phl)),
  calibratedMedianPhl: median(episodes.map((e) => e.calibrated.phl)),
  staticMedianPhl: median(episodes.map((e) => e.staticPriority.phl)),
  calibratedLowerPhlThanStatic: episodes.filter((e) => e.calibrated.phl < e.staticPriority.phl).length,
  medianUnservedPUHours: {
    calibrated: median(episodes.map((e) => e.unservedPUHours.calibrated)),
    previousDay: median(episodes.map((e) => e.unservedPUHours.previousDay)),
    staticPriority: median(episodes.map((e) => e.unservedPUHours.staticPriority)),
  },
  medianUnusedSupplyPUHours: {
    calibrated: median(episodes.map((e) => e.unusedSupplyPUHours.calibrated)),
    previousDay: median(episodes.map((e) => e.unusedSupplyPUHours.previousDay)),
    staticPriority: median(episodes.map((e) => e.unusedSupplyPUHours.staticPriority)),
  },
  medianPairedPhlDifference: median(episodes.map((e) => e.phlDifference)),
  medianPairedDamageDifference: median(episodes.map((e) => e.damageDifference)),
  medianCalibratedPairedPhlDifference: median(episodes.map((e) => e.calibratedPhlDifference)),
  medianCalibratedVsRawPhlDifference: median(episodes.map((e) => e.calibratedVsRawPhlDifference)),
  allRunsSafe: episodes.every((e) => e.xgboost.violations === 0 && e.calibrated.violations === 0 && e.previousDay.violations === 0 && e.staticPriority.violations === 0),
  episodes,
};
await mkdir("experiments/ml", { recursive: true });
await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, episodes: undefined }, null, 2));
