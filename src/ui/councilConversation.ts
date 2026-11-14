import type { Message, Tick } from "../contract/types";
export interface ConversationEntry {
  message: Message;
  deliveries: number;
  lost: number;
  text: string;
}
export function describeMessage(m: Message): string {
  switch (m.type) {
    case "BID":
      return m.bid
        ? `I request ${m.bid.demand.toFixed(2)} power units. My minimum is ${m.bid.minimum.toFixed(2)}; backup remaining ${m.bid.reserveHours.toFixed(2)} hours.`
        : m.reason;
    case "COUNTER":
    case "CONCEDE":
      return `${m.type === "CONCEDE" ? "I can concede to" : "My current proposal is"} ${m.allocation?.toFixed(2) ?? "—"} power units. ${m.phase === "plan" ? "Checking our approved schedule." : `Responding to the ${m.phase ?? "clearing"} price.`}`;
    case "ACCEPT":
      return `I accept my local proposal. Checking agreement with the council (${m.hash}).`;
    case "PREPARE":
      return `My allocation fingerprint is ${m.hash}. Does everyone agree?`;
    case "COMMIT":
      return `Agreement confirmed. Apply allocation ${m.hash}; safety checks passed.`;
    case "ABORT":
      return `We cannot commit this proposal. ${m.reason}`;
    case "HEARTBEAT":
      return "I am present and participating.";
  }
}
// Collapse delivery copies only: preserve attempts, phases, order, losses and real responses.
export function conversation(tick: Tick | null): ConversationEntry[] {
  if (!tick) return [];
  const entries: ConversationEntry[] = [],
    byKey = new Map<string, ConversationEntry>();
  for (const m of tick.negotiation.messages) {
    if (m.type === "HEARTBEAT") continue;
    const key = JSON.stringify([
      m.sender,
      m.type,
      m.round,
      m.attempt,
      m.phase,
      m.bid,
      m.allocation,
      m.price,
      m.hash,
    ]);
    const existing = byKey.get(key);
    if (existing) {
      existing.deliveries += Number(m.delivered);
      existing.lost += Number(!m.delivered);
    } else {
      const entry = {
        message: m,
        deliveries: Number(m.delivered),
        lost: Number(!m.delivered),
        text: describeMessage(m),
      };
      byKey.set(key, entry);
      entries.push(entry);
    }
  }
  return entries;
}
