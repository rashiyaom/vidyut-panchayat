import { mkdir, writeFile } from "node:fs/promises";
import { cpus, platform } from "node:os";
import profiles from "../data/agents/profiles.json";
import network from "../data/network/electrical_v1.json";
import scenario from "../data/scenarios/cyclone_24h.json";
import { configSchema, ENGINE_VERSION } from "../src/contract/schemas";
import { initialWorld, step } from "../src/engine/world";
import { createPlan } from "../src/engine/planning/planner";
import { preSim } from "../src/engine/planning/presim";
const config = configSchema.parse({
  version: 1,
  seed: 42,
  strategy: "council",
  profiles,
  network,
  scenario,
  enabledAgents: profiles.agents.map((p) => p.id),
});
let world = initialWorld(config);
const timings: number[] = [];
for (let t = 0; t < 144; t++) {
  const started = performance.now();
  world = step(world).world;
  timings.push(performance.now() - started);
}
const source = initialWorld(config),
  plan = createPlan(source);
const started = performance.now();
preSim(source, plan, 30);
const presimMs = performance.now() - started;
const sorted = timings.slice().sort((a, b) => a - b);
const report = {
  engineVersion: ENGINE_VERSION,
  node: process.version,
  platform: platform(),
  cpu: cpus()[0]?.model,
  ticks: 144,
  tickMs: {
    median: sorted[71],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    max: sorted.at(-1),
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  },
  presim: { futures: 30, horizon: 18, strategies: 4, ms: presimMs },
  note: "Local Node wall-clock measurement; includes whole engine tick, not rendering. Cold-start/GC outliers are retained. Browser FPS is measured separately.",
};
await mkdir("experiments/results", { recursive: true });
await writeFile(
  "experiments/results/performance.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
