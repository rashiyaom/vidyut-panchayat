import profiles from "../data/agents/profiles.json";
import network from "../data/network/electrical_v1.json";
import scenario from "../data/scenarios/cyclone_24h.json";
import { configSchema } from "../src/contract/schemas";
export const config = configSchema.parse({
  version: 1,
  seed: 42,
  strategy: "council",
  profiles,
  network,
  scenario,
  enabledAgents: profiles.agents.map((p) => p.id),
});
