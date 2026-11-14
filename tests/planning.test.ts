import { expect, it } from "vitest";
import { config } from "./fixtures";
import { initialWorld } from "../src/engine/world";
import { createPlan } from "../src/engine/planning/planner";
import { validatePlan } from "../src/engine/constitution/planValidator";
import { planHash } from "../src/engine/planning/planDocument";
import { preSim, guardrails, metricNames } from "../src/engine/planning/presim";
import { verify } from "../src/engine/planning/verify";
import type { Metrics } from "../src/contract/types";
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
