import { expect, it } from "vitest";
import { config } from "./fixtures";
import { configSchema } from "../src/contract/schemas";
import { run } from "../src/engine/world";
it("rejects duplicate IDs, impossible references, negative capacities and malformed timing", () => {
  for (const mutate of [
    (c: typeof config) => {
      c.network.feeders[0].capacity = -1;
    },
    (c: typeof config) => {
      c.profiles.agents[1].id = c.profiles.agents[0].id;
    },
    (c: typeof config) => {
      c.scenario.events[0].tick = 144;
    },
    (c: typeof config) => {
      c.network.feeders[0].bus = "unknown" as never;
    },
  ]) {
    const c = structuredClone(config);
    mutate(c);
    expect(() => configSchema.parse(c)).toThrow();
  }
});
it("replays ten deterministic ticks in Node", () => {
  expect(JSON.stringify(run(config, 10))).toBe(JSON.stringify(run(config, 10)));
  expect(run({ ...config, seed: 43 }, 10)).not.toEqual(run(config, 10));
});
it("rejects malformed worker messages and duplicate tick records at the boundary", async () => {
  const { commandSchema, replySchema, tickSchema } =
    await import("../src/contract/schemas");
  expect(() =>
    commandSchema.parse({ requestId: 1, type: "RUN", speed: 0 }),
  ).toThrow();
  expect(() =>
    replySchema.parse({
      requestId: 1,
      type: "TICK",
      branch: 0,
      sequence: 1,
      tick: { t: 0 },
    }),
  ).toThrow();
  const tick = run(config, 1)[0];
  tick.agents[1] = tick.agents[0];
  expect(() => tickSchema.parse(tick)).toThrow();
});
