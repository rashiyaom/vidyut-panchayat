import { expect, it } from "vitest";
import { decisionGuide } from "../src/ui/DecisionGuide";
import { CouncilStore } from "../src/app/store";
import { createPlan } from "../src/engine/planning/planner";
import { preSim } from "../src/engine/planning/presim";
import { initialWorld } from "../src/engine/world";
import { config } from "./fixtures";
it("explains preparation without offering approval before evidence exists", () => {
  const store = new CouncilStore();
  const html = decisionGuide(store, config);
  expect(html).toContain("prepare the city");
  expect(html).not.toContain('id="guide-approve"');
});
it("shows real forecast values and flags failed guardrails in plain language", () => {
  const store = new CouncilStore(),
    world = initialWorld(config);
  store.plan = createPlan(world, 3);
  store.presim = preSim(world, store.plan, 2);
  store.state = "AwaitingHuman";
  store.presim.plan.hospitalMin.p10 = 0.3;
  store.presim.guardrails[3].pass = false;
  store.presim.autoApproved = false;
  const html = decisionGuide(store, config);
  expect(html).toContain("30%");
  expect(html).toContain("Human judgment is needed");
  expect(html).toContain("Needs review");
  expect(html).toContain("Approve this plan");
  expect(html).toContain(store.plan.id);
});
