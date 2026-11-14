import { expect, it } from "vitest";
import { conversation } from "../src/ui/councilConversation";
import { run } from "../src/engine/world";
import { config } from "./fixtures";
it("summarizes directed delivery copies without fabricating speech or hiding losses", () => {
  const tick = run(config, 1)[0];
  const bid = tick.negotiation.messages.find((m) => m.type === "BID")!;
  tick.negotiation.messages = [
    { ...bid, recipient: "water", delivered: true },
    { ...bid, recipient: "hospital", delivered: false },
    { ...bid, attempt: 1, recipient: "hospital", delivered: true },
  ];
  const chat = conversation(tick);
  expect(chat).toHaveLength(2);
  expect(chat[0].deliveries).toBe(1);
  expect(chat[0].lost).toBe(1);
  expect(chat[1].message.attempt).toBe(1);
  expect(chat[0].text).toContain(bid.bid!.demand.toFixed(2));
});
it("preserves proposal and commitment distinction and skips heartbeat noise", () => {
  const tick = run(config, 1)[0],
    chat = conversation(tick);
  expect(chat.some((e) => e.message.type === "HEARTBEAT")).toBe(false);
  expect(chat.find((e) => e.message.type === "ACCEPT")!.text).toContain(
    "local proposal",
  );
  expect(chat.find((e) => e.message.type === "COMMIT")!.text).toContain(
    "Agreement confirmed",
  );
  expect(conversation(null)).toEqual([]);
});
