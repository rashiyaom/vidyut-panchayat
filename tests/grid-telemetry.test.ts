import { expect, it } from "vitest";
import telemetry from "../data/processed/telemetry/pt_load_2014-09-15.json";
import { gridTelemetrySchema } from "../src/contract/schemas";
import { gridLoadAt } from "../src/contract/gridTelemetry";
import { initialWorld, step } from "../src/engine/world";
import { createPlan } from "../src/engine/planning/planner";
import { config } from "./fixtures";

const dated = gridTelemetrySchema.parse(telemetry);

it("validates national load timestamps and reveals only completed hours", () => {
  expect(dated.samples.map((sample) => sample.loadMw)).toEqual([4528, 4357, 4241, 4184]);
  expect(gridLoadAt(dated, 0)).toEqual(dated.samples[0]);
  expect(gridLoadAt(dated, 5)).toEqual(dated.samples[0]);
  expect(gridLoadAt(dated, 6)).toEqual(dated.samples[1]);
  expect(gridLoadAt(dated, 12)).toEqual(dated.samples[2]);
  expect(gridLoadAt(dated, 18)).toBeUndefined();
  expect(gridTelemetrySchema.safeParse({ ...telemetry, samples: [
    { ...telemetry.samples[0], periodEndUtc: telemetry.samples[1].periodEndUtc },
    ...telemetry.samples.slice(1),
  ] }).success).toBe(false);
});

it("keeps measured national load out of supply, allocations, and planning", () => {
  let observed = initialWorld(config);
  let baseline = initialWorld(config);
  observed.gridTelemetry = dated;
  expect(createPlan(observed, 3).hash).toBe(createPlan(baseline, 3).hash);
  for (let tick = 0; tick < 7; tick++) {
    const a = step(observed);
    const b = step(baseline);
    observed = a.world;
    baseline = b.world;
    const { gridLoad, ...measuredTick } = a.tick;
    expect(measuredTick).toEqual(b.tick);
    expect(gridLoad).toEqual(dated.samples[Math.floor(tick / 6)]);
  }
});
