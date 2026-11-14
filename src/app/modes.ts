import type { PlanState } from "../contract/types";
export const needsApproval = (state: PlanState) => state === "AwaitingHuman";
export const busy = (state: PlanState) =>
  ["Negotiating", "Validating", "PreSimulating"].includes(state);
