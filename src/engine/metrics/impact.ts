import type { AgentTick } from "../../contract/types";
import { DT } from "../clock";
export const phl = (agents: AgentTick[]) =>
  agents.reduce((s, a) => s + a.exposure * (1 - a.service) * DT, 0);
