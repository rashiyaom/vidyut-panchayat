import { expect, it } from "vitest";
import { config } from "./fixtures";
import { environment } from "../src/engine/events";
import { initialWorld, step } from "../src/engine/world";
import { createPlan } from "../src/engine/planning/planner";
import { validatePlan } from "../src/engine/constitution/planValidator";
import { EngineRuntime } from "../src/worker/runtime";
import weatherReplay from "../data/ml/weather_browser_replay_v1.json";
import electricityReplay from "../data/ml/browser_replay_v1.json";
import type { WeatherForecast } from "../src/contract/types";

const mild: WeatherForecast = {
  originPortugal: "2014-09-15T00:00:00+01:00",
  windSpeed: [4.746, 4.68, 4.649],
  precipitation: [0.4, 0, 0],
};
const severe: WeatherForecast = {
  ...mild,
  windSpeed: [25, 25, 25],
  precipitation: [0, 0, 0],
};

it("uses only forecast weather, leaves mild conditions unchanged, and stops after three hours", () => {
  expect(environment(config, 0, [], mild)).toEqual(environment(config, 0));
  expect(environment(config, 18, [], severe)).toEqual(environment(config, 18));
  const laterRain = { ...mild, precipitation: [0, 20, 0] };
  expect(environment(config, 5, [], laterRain)).toEqual(environment(config, 5));
  expect(environment(config, 6, [], laterRain).supply).toBeLessThan(environment(config, 6).supply);
  expect(environment(config, 12, [], laterRain)).toEqual(environment(config, 12));
});

it("derates supply and feeders in both the approved plan and execution", () => {
  const baseline = initialWorld(config);
  const stressed = initialWorld(config);
  stressed.weatherForecast = severe;
  const baseEnv = environment(config, 0);
  const stressedEnv = environment(config, 0, [], severe);
  expect(stressedEnv.supply).toBe(0.75 * baseEnv.supply);
  expect(stressedEnv.feederCaps.hospital).toBeLessThan(baseEnv.feederCaps.hospital);

  const basePlan = createPlan(baseline, 3);
  const stressPlan = createPlan(stressed, 3);
  expect(stressPlan.constitution.ok).toBe(true);
  expect(validatePlan(stressPlan, config.network, stressed).ok).toBe(true);
  expect(stressPlan.blocks[0].supply).toBeLessThan(basePlan.blocks[0].supply);
  expect(stressPlan.blocks[0].feederCaps.hospital).toBeLessThan(basePlan.blocks[0].feederCaps.hospital);
  const result = step(stressed, stressPlan);
  expect(result.tick.supply).toBe(stressedEnv.supply);
  expect(result.tick.lines.find((line) => line.id === "feeder-hospital")?.capacity)
    .toBe(stressedEnv.feederCaps.hospital);
  expect(result.tick.metrics.violations).toBe(0);
});

it("accepts the bundled matching-date forecast and rejects a mismatched replay date", async () => {
  const replies: unknown[] = [];
  const runtime = new EngineRuntime((reply) => replies.push(reply), async () => {});
  const historicalReplay = {
    origin: electricityReplay.origin,
    modelSha256: electricityReplay.modelSha256,
    actualDemand: Array.from({ length: 18 }, (_, tick) => electricityReplay.actualDemand[String(tick) as keyof typeof electricityReplay.actualDemand]),
    forecastDemand: Array.from({ length: 18 }, (_, tick) => electricityReplay.forecastDemand[String(tick) as keyof typeof electricityReplay.forecastDemand]),
    supplyFraction: 1 as const,
    weatherForecast: {
      originPortugal: weatherReplay.originPortugal,
      windSpeed: weatherReplay.weather.wind_speed_10m.rows.map((row) => row.forecast),
      precipitation: weatherReplay.weather.precipitation.rows.map((row) => row.forecast),
    },
  };
  await runtime.handle({ type: "INIT", config, historicalReplay, requestId: 1 });
  expect(runtime.branches.get(0)?.worlds[0].weatherForecast).toEqual(historicalReplay.weatherForecast);
  await runtime.handle({ type: "INIT", config, historicalReplay: {
    ...historicalReplay,
    weatherForecast: { ...historicalReplay.weatherForecast, originPortugal: "2014-09-16T00:00:00+01:00" },
  }, requestId: 2 });
  expect(replies.at(-1)).toMatchObject({ type: "ERROR", message: "Weather forecast date differs from electricity replay date" });
  runtime.dispose();
});
