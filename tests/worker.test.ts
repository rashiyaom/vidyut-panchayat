import { expect, it } from "vitest";
import { EngineRuntime } from "../src/worker/runtime";
import { config } from "./fixtures";
import browserReplay from "../data/ml/browser_replay_v1.json";
import type { Reply, CommandInput, Plan, Allocation } from "../src/contract/types";
function fixture() {
  const replies: Reply[] = [];
  const runtime = new EngineRuntime(
    (r) => replies.push(r),
    () => Promise.resolve(),
  );
  let id = 0;
  return {
    runtime,
    replies,
    send: (command: CommandInput) =>
      runtime.handle({ ...command, requestId: ++id }),
  };
}
it("rejects malformed commands visibly and stale approval; rejection produces a new proposal", async () => {
  const f = fixture();
  await f.send({ type: "INIT", config });
  await f.runtime.handle({ type: "TOGGLE_AGENT", id: "bogus" });
  expect(f.replies.at(-1)?.type).toBe("ERROR");
  await f.send({ type: "REQUEST_PLAN", horizonTicks: 3 });
  const p = (f.replies.find((r) => r.type === "PLAN_READY") as { plan: Plan })
    .plan;
  await f.send({ type: "APPROVE", planId: p.id, hash: "wrong" });
  expect(f.replies.at(-1)?.type).toBe("ERROR");
  await f.send({ type: "REJECT", planId: p.id, note: "Protect water" });
  const plans = f.replies.filter((r) => r.type === "PLAN_READY");
  expect(plans.length).toBe(2);
  expect(plans[1].plan.id).not.toBe(p.id);
  await f.send({ type: "APPROVE", planId: p.id, hash: p.hash });
  expect(f.replies.at(-1)?.type).toBe("ERROR");
  f.runtime.dispose();
}, 20000);
it("seek and toggle retain the original branch, and pause prevents timer advancement", async () => {
  const f = fixture();
  await f.send({ type: "INIT", config: { ...config, strategy: "equal" } });
  for (let i = 0; i < 4; i++) await f.send({ type: "STEP" });
  const original = JSON.stringify(f.runtime.branches.get(0));
  await f.send({ type: "SEEK", tick: 1 });
  await f.send({ type: "TOGGLE_AGENT", id: "residential", enabled: false });
  await f.send({ type: "STEP" });
  expect(f.runtime.branch).toBe(1);
  expect(JSON.stringify(f.runtime.branches.get(0))).toBe(original);
  await f.send({ type: "RUN", speed: 8 });
  await f.send({ type: "RUN", speed: 8 });
  await f.send({ type: "PAUSE" });
  const length = f.runtime.branches.get(1)!.ticks.length;
  await new Promise((r) => setTimeout(r, 150));
  expect(f.runtime.branches.get(1)!.ticks.length).toBe(length);
  f.runtime.dispose();
});
it("finishes an approved horizon with verification instead of repeatedly alarming on an already-low reserve", async () => {
  const f = fixture();
  await f.send({ type: "INIT", config });
  await f.send({ type: "REQUEST_PLAN", horizonTicks: 3 });
  const plan = (
    f.replies.find((r) => r.type === "PLAN_READY") as { plan: Plan }
  ).plan;
  await f.send({ type: "APPROVE", planId: plan.id, hash: plan.hash });
  for (let i = 0; i < 3; i++) await f.send({ type: "STEP" });
  expect(f.replies.some((r) => r.type === "VERIFICATION")).toBe(true);
  f.runtime.dispose();
}, 20000);
it("AUTO refuses a crisis plan when any guardrail fails", async () => {
  const f = fixture();
  const crisis = {
    ...config,
    scenario: { ...config.scenario, initialSupply: 5, events: [] },
  };
  await f.send({ type: "INIT", config: crisis });
  await f.send({ type: "SET_MODE", mode: "auto" });
  await f.send({ type: "REQUEST_PLAN", horizonTicks: 3 });
  const states = f.replies.filter((r) => r.type === "PLAN_STATE");
  expect(states.at(-1)?.state).toBe("AwaitingHuman");
  await f.send({ type: "STEP" });
  expect(f.replies.at(-1)?.type).toBe("ERROR");
  expect(f.runtime.branches.get(0)!.ticks.length).toBe(0);
  f.runtime.dispose();
}, 20000);
it("RUN replays existing history without drafting a stale plan", async () => {
  const f = fixture();
  await f.send({ type: "INIT", config });
  await f.send({ type: "REQUEST_PLAN", horizonTicks: 3 });
  const plan = (
    f.replies.find((r) => r.type === "PLAN_READY") as { plan: Plan }
  ).plan;
  await f.send({ type: "APPROVE", planId: plan.id, hash: plan.hash });
  for (let i = 0; i < 3; i++) await f.send({ type: "STEP" });
  await f.send({ type: "SEEK", tick: 0 });
  const before = f.replies.filter((r) => r.type === "PLAN_READY").length;
  await f.send({ type: "RUN", speed: 8 });
  await new Promise((r) => setTimeout(r, 150));
  await f.send({ type: "PAUSE" });
  expect(f.replies.filter((r) => r.type === "PLAN_READY").length).toBe(before);
  expect(f.replies.filter((r) => r.type === "TICK").at(-1)?.tick.t).toBe(1);
  f.runtime.dispose();
}, 20000);
it("correlates invalid command errors to their request instead of the last valid command", async () => {
  const f = fixture();
  await f.send({ type: "INIT", config });
  await f.runtime.handle({ requestId: 991, type: "RUN", speed: -2 });
  expect(f.replies.at(-1)).toMatchObject({ type: "ERROR", requestId: 991 });
  f.runtime.dispose();
});
it("runs the trained-model historical replay with held-out demand and stops at 18 ticks", async () => {
  const f = fixture();
  const actualDemand = Array.from({ length: 18 }, (_, t) => browserReplay.actualDemand[String(t) as keyof typeof browserReplay.actualDemand] as Allocation);
  const forecastDemand = Array.from({ length: 18 }, (_, t) => browserReplay.forecastDemand[String(t) as keyof typeof browserReplay.forecastDemand] as Allocation);
  await f.send({ type: "INIT", config: { ...config, scenario: { ...config.scenario, demandNoise: 0, dropRate: 0, timingJitter: 0 } },
    historicalReplay: { origin: browserReplay.origin, modelSha256: browserReplay.modelSha256,
      actualDemand, forecastDemand, supplyFraction: 1 } });
  await f.send({ type: "REQUEST_PLAN", horizonTicks: 18 });
  const plan = f.replies.find((r) => r.type === "PLAN_READY") as { plan: Plan };
  expect(plan.plan.constitution.ok).toBe(true);
  await f.send({ type: "APPROVE", planId: plan.plan.id, hash: plan.plan.hash });
  for (let i = 0; i < 18; i++) await f.send({ type: "STEP" });
  const ticks = f.runtime.branches.get(0)!.ticks;
  expect(ticks).toHaveLength(18);
  expect(ticks[0].agents.find((a) => a.id === "hospital")?.demand).toBe(actualDemand[0].hospital);
  expect(ticks.every((t) => t.constitution.ok)).toBe(true);
  await f.send({ type: "STEP" });
  expect(f.runtime.branches.get(0)!.ticks).toHaveLength(18);
  f.runtime.dispose();
}, 30000);
