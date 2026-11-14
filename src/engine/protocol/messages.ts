import type { Allocation, Message } from "../../contract/types";
import { agentIds } from "../../contract/schemas";
export function hashText(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export const allocationHash = (a: Allocation) =>
  hashText(agentIds.map((id) => `${id}:${Math.round(a[id] * 100)}`).join("|"));
export const message = (m: Omit<Message, "delivered">): Message => ({
  ...m,
  delivered: true,
});
