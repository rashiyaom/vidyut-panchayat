import type { Plan } from "../contract/types";
import { escape } from "./NegotiationFeed";
export const planDocument = (p: Plan | null) =>
  p
    ? `<pre>${escape(p.document)}</pre>`
    : "<p>Request an 18-tick forward plan.</p>";
