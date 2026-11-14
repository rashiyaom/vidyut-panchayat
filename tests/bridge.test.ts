import { afterEach, expect, it, vi } from "vitest";
import { EngineBridge } from "../src/worker/bridge";
import type { Reply } from "../src/contract/types";
class FakeWorker {
  static latest: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  sent: unknown[] = [];
  terminated = false;
  constructor() {
    FakeWorker.latest = this;
  }
  postMessage(message: unknown) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(reply: unknown) {
    this.onmessage?.({ data: reply });
  }
}
afterEach(() => vi.unstubAllGlobals());
it("stale reply sequences are ignored and malformed replies fail pending work on the current branch", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const bridge = new EngineBridge(),
    worker = FakeWorker.latest,
    replies: Reply[] = [];
  bridge.subscribe((r) => replies.push(r));
  const first = bridge.send({ type: "PAUSE" });
  worker.reply({
    type: "ACK",
    requestId: 1,
    branch: 3,
    sequence: 2,
    command: "PAUSE",
  });
  await first;
  worker.reply({
    type: "PLAN_STATE",
    requestId: 1,
    branch: 0,
    sequence: 1,
    state: "Idle",
    mode: "human",
    running: true,
  });
  expect(replies).toHaveLength(1);
  const pending = bridge.send({ type: "STEP" });
  const rejection = expect(pending).rejects.toThrow("Invalid worker reply");
  worker.reply({
    type: "TICK",
    requestId: 2,
    branch: 3,
    sequence: 3,
    tick: null,
  });
  await rejection;
  expect(worker.terminated).toBe(true);
  expect(replies.at(-1)?.branch).toBe(3);
  await expect(bridge.send({ type: "STEP" })).rejects.toThrow(
    "Invalid worker reply",
  );
  bridge.dispose();
});
