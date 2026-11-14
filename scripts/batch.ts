import { mkdir, writeFile } from "node:fs/promises";
import profiles from "../data/agents/profiles.json";
import network from "../data/network/electrical_v1.json";
import scenario from "../data/scenarios/cyclone_24h.json";
import { configSchema, ENGINE_VERSION, VERSION } from "../src/contract/schemas";
import type { Bid, Strategy } from "../src/contract/types";
import { run } from "../src/engine/world";
import { distribution } from "../src/engine/planning/presim";
import { environment } from "../src/engine/events";
import { optimum } from "../src/engine/baselines/optimum";
const seeds = Number(
  process.argv.find((a) => a.startsWith("--seeds="))?.split("=")[1] ?? 50,
);
if (!Number.isInteger(seeds) || seeds < 1)
  throw new Error("seeds must be a positive integer");
const rows: Record<string, string | number>[] = [];
await mkdir("experiments/results", { recursive: true });
for (let seed = 0; seed < seeds; seed++)
  for (const strategy of [
    "council",
    "static",
    "equal",
    "optimum",
  ] as Strategy[]) {
    const config = configSchema.parse({
      version: 1,
      seed,
      strategy,
      profiles,
      network,
      scenario: { ...scenario, timingJitter: 3, dropRate: 0.01 },
      enabledAgents: profiles.agents.map((p) => p.id),
    });
    const ticks = run(config);
    const metrics = ticks.at(-1)!.metrics;
    let oracleObjective = 0;
    for (const tick of ticks) {
      const c = { ...environment(config, tick.t), network: config.network };
      const bids: Bid[] = tick.agents.map((a) => ({
        id: a.id,
        demand: a.demand,
        minimum: 0,
        value: a.weight,
        flexibility: 1,
        reserveHours: 0,
        bus: config.network.feeders.find((f) => f.id === a.id)!.bus,
        cap: c.feederCaps[a.id],
      }));
      const best = optimum(bids, c);
      oracleObjective += bids.reduce((s, b) => s + b.value * best[b.id], 0);
    }
    rows.push({
      seed,
      scenario: config.scenario.id,
      strategy,
      engineVersion: ENGINE_VERSION,
      contractVersion: VERSION,
      ...metrics,
      oracleObjective,
      objectiveGap: oracleObjective - metrics.weightedService,
    });
    if (seed === 0 && strategy === "council") {
      const crisis = ticks.find(
        (t) =>
          t.supply === 55 &&
          t.lines.find((l) => l.id === "bus-central")?.capacity === 30,
      )!;
      await writeFile(
        "experiments/results/crisis_trace.json",
        JSON.stringify(crisis, null, 2),
      );
    }
  }
const keys = Object.keys(rows[0]);
await writeFile(
  "experiments/results/cyclone.csv",
  [
    keys.join(","),
    ...rows.map((row) => keys.map((k) => row[k]).join(",")),
  ].join("\n") + "\n",
);
let summary = `# Measured cyclone results\n\nActual matrix: 1 scenario × 4 strategies × ${seeds} seeds = ${rows.length} runs, each 144 ticks. Engine ${ENGINE_VERSION}, contract ${VERSION}. Demand ±10%, event jitter ±3 ticks, directed message drop rate 1%. Extra scenarios are not implemented or measured.\n\nSynthetic service exposures overlap; no casualty claims. Entries are median [p10, p90].\n\n| Strategy | PHL | Damage | Hospital min | Fairness | Critical uptime | Weighted PU gap to full-information one-tick oracle | Violations |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`;
const fmt = (values: number[]) => {
  const d = distribution(values);
  const f = (x: number) => x.toFixed(3);
  return `${f(d.p50)} [${f(d.p10)}, ${f(d.p90)}]`;
};
for (const strategy of ["council", "static", "equal", "optimum"]) {
  const subset = rows.filter((r) => r.strategy === strategy);
  summary += `| ${strategy} | ${["phl", "damage", "hospitalMin", "fairness", "criticalUptime", "objectiveGap", "violations"].map((key) => fmt(subset.map((r) => Number(r[key])))).join(" | ")} |\n`;
}
summary +=
  "\nStatic and optimum share the same fixed-weight greedy rule under this linear objective. Software-crash hold constraints can keep their live allocations below the fully responsive oracle, whose gap is explicitly reported. Council is not expected to win every metric; message drops and conservative fallback can substantially increase service loss. The oracle maximizes sum W×grid PU, not effective service, fairness or cumulative PHL.\n";
await writeFile("experiments/results/summary.md", summary);
console.log(summary);
