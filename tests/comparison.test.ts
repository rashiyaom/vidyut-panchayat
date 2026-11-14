import { expect, it } from "vitest";
import type { CommandInput, Reply, Tick } from "../src/contract/types";
import { SplitComparison } from "../src/compare/splitScreen";
import { EngineRuntime } from "../src/worker/runtime";
import { config } from "./fixtures";
function fixture() {
  const listeners = new Set<(r: Reply) => void>();
  let id = 0,
    failNext = false,
    release: (() => void) | null = null,
    gate: Promise<void> | null = null;
  const runtime = new EngineRuntime(
    (r) => {
      for (const listener of listeners) listener(r);
    },
    () => Promise.resolve(),
  );
  const received: Tick[] = [];
  const bridge = {
    subscribe(fn: (r: Reply) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async send(command: CommandInput) {
      if (gate) {
        await gate;
        gate = null;
      }
      if (failNext) {
        failNext = false;
        throw new Error("Injected bridge error");
      }
      await runtime.handle({ ...command, requestId: ++id });
    },
    dispose() {
      runtime.dispose();
    },
  };
  const comparison = new SplitComparison(
    config,
    (t) => received.push(t),
    bridge,
  );
  return {
    comparison,
    received,
    fail() {
      failNext = true;
    },
    hold() {
      gate = new Promise<void>((r) => {
        release = r;
      });
    },
    release() {
      release?.();
    },
  };
}
it("drops stale comparison results after a strategy switch during initialization", async () => {
  const f = fixture();
  f.hold();
  const old = f.comparison.sync(2);
  await Promise.resolve();
  f.comparison.setStrategy("equal");
  const next = f.comparison.sync(2);
  f.release();
  await Promise.all([old, next]);
  expect(f.received).toHaveLength(1);
  expect(f.received[0].strategy).toBe("equal");
  expect(f.received[0].t).toBe(2);
  f.comparison.dispose();
});
it("recovers after worker rejection and replays an intervention at the exact tick", async () => {
  const f = fixture();
  f.fail();
  await expect(f.comparison.sync(0)).rejects.toThrow("Injected");
  await f.comparison.sync(0);
  f.comparison.intervene(
    {
      type: "TRIGGER_EVENT",
      event: { type: "supply", tick: 1, value: 10, label: "Comparison event" },
    },
    1,
  );
  await f.comparison.sync(1);
  expect(f.received.at(-1)?.supply).toBe(10);
  expect(f.received.at(-1)?.t).toBe(1);
  f.comparison.dispose();
});
