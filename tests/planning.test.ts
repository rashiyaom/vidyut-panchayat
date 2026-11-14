import { expect, it } from "vitest";
import { config } from "./fixtures";
import { initialWorld } from "../src/engine/world";
import { createPlan } from "../src/engine/planning/planner";
import { validatePlan } from "../src/engine/constitution/planValidator";
import { planHash } from "../src/engine/planning/planDocument";
import { preSim, guardrails, metricNames } from "../src/engine/planning/presim";
import { verify } from "../src/engine/planning/verify";
import type { Allocation, Metrics } from "../src/contract/types";
it("negotiates six blocks, checks all contingency branches and rejects illegal plans", () => {
  const p = createPlan(initialWorld(config));
  expect(p.blocks.length).toBe(6);
  expect(p.constitution.ok).toBe(true);
  p.contingencies[0].blocks[0].allocations.hospital = 1000;
  p.hash = planHash(p);
  expect(validatePlan(p, config.network).ok).toBe(false);
});
it("pre-simulation is reproducible and guardrails escalate failures", () => {
  const w = initialWorld(config),
    p = createPlan(w, 3);
  const a = preSim(w, p, 3);
  expect(a).toEqual(preSim(w, p, 3));
  expect(a.seeds).not.toContain(config.seed);
  a.plan.hospitalMin.p10 = 0.2;
  expect(guardrails(p, a).every((g) => g.pass)).toBe(false);
});
it("verification separates PASS, DRIFT and FAIL with metric evidence", () => {
  const w = initialWorld(config),
    p = createPlan(w, 3),
    r = preSim(w, p, 1);
  for (const key of metricNames)
    r.plan[key] = { min: 0, p10: 2, p50: 3, p90: 4, max: 6 };
  const metrics = Object.fromEntries(metricNames.map((k) => [k, 3])) as Metrics;
  expect(verify(r, metrics).result).toBe("PASS");
  metrics.phl = 5;
  expect(verify(r, metrics).result).toBe("DRIFT");
  metrics.phl = 7;
  expect(verify(r, metrics).result).toBe("FAIL");
});
it("does not trust a plan that claims a larger forecast envelope", () => {
  const w = initialWorld(config),
    p = createPlan(w);
  p.blocks[0].supply = 10000;
  p.hash = planHash(p);
  expect(validatePlan(p, config.network, w).ok).toBe(false);
});
it("permits a bounded replay supply fraction and validates its declared envelope", () => {
  const baseline = createPlan(initialWorld(config), 3);
  const replay = initialWorld(config);
  replay.planSupplyFraction = 1;
  const expanded = createPlan(replay, 3);
  expect(expanded.constitution.ok).toBe(true);
  expect(expanded.blocks[0].supply).toBeGreaterThan(baseline.blocks[0].supply);
  expanded.blocks[0].supply += 1;
  expanded.hash = planHash(expanded);
  expect(validatePlan(expanded, config.network, replay).ok).toBe(false);
  replay.planSupplyFraction = 1.01;
  expect(() => createPlan(replay, 3)).toThrow();
});
it("keeps held-out observed demand out of plan construction", () => {
  const first = initialWorld(config);
  const second = initialWorld(config);
  const forecast = Object.fromEntries(config.profiles.agents.map((p) => [p.id, p.demand])) as Allocation;
  first.forecastDemand = { 0: forecast };
  second.forecastDemand = { 0: forecast };
  first.planFillFraction = second.planFillFraction = 1;
  first.planPriorityBlend = second.planPriorityBlend = 0.45;
  first.observedDemand = { 0: Object.fromEntries(config.profiles.agents.map((p) => [p.id, 1])) as Allocation };
  second.observedDemand = { 0: Object.fromEntries(config.profiles.agents.map((p) => [p.id, 100])) as Allocation };
  expect(createPlan(first, 3).hash).toBe(createPlan(second, 3).hash);
});
it("top-up plans preserve negotiated allocations and capacity safety", () => {
  const base = initialWorld(config);
  base.planSupplyFraction = 1;
  const original = createPlan(base, 3);
  base.planFillFraction = 1;
  const improved = createPlan(base, 3);
  expect(improved.constitution.ok).toBe(true);
  for (const [i, block] of original.blocks.entries())
    for (const id of Object.keys(block.allocations) as (keyof Allocation)[])
      expect(improved.blocks[i].allocations[id]).toBeGreaterThanOrEqual(block.allocations[id] - 0.01);
  base.planFillFraction = 1.01;
  expect(() => createPlan(base, 3)).toThrow();
});
it("priority compromises stay within the approved forecast envelope", () => {
  const world = initialWorld(config);
  world.planSupplyFraction = 1;
  world.planPriorityBlend = 0.5;
  const plan = createPlan(world, 6);
  expect(plan.constitution.ok).toBe(true);
  expect(validatePlan(plan, config.network, world).ok).toBe(true);
  world.planPriorityBlend = -0.1;
  expect(() => createPlan(world, 3)).toThrow();
});
