import type { AgentId, Message } from "../../contract/types";
import { rng } from "../rng";
export class MessageBus {
  readonly trace: Message[] = [];
  private random: () => number;
  constructor(
    seed: number,
    private dropRate = 0,
    private forced = false,
    private delayed: AgentId | null = null,
  ) {
    this.random = rng(seed);
  }
  send(m: Message): boolean {
    const vulnerable = m.type === "BID" || m.type === "PREPARE";
    const dropped =
      vulnerable &&
      m.recipient !== m.sender &&
      (this.random() < this.dropRate ||
        (this.forced && m.type === "BID") ||
        m.sender === this.delayed);
    this.trace.push({
      ...m,
      delivered: !dropped,
      reason: dropped
        ? `${m.reason}; dropped or arrived after tick barrier`
        : m.reason,
    });
    return !dropped;
  }
}
