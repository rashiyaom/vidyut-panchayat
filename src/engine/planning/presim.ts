import type {
  Distribution,
  Evidence,
  Metrics,
  Plan,
  PreSimResult,
  Strategy,
  Tick,
} from "../../contract/types";
import { rng } from "../rng";
import { step, type World } from "../world";
import { windowMetrics } from "../metrics/scoring";
export const metricNames = [
  "phl",
  "damage",
  "hospitalMin",
  "fairness",
  "violations",
] as const;
export function distribution(values: number[]): Distribution {
  const sorted = values.slice().sort((a, b) => a - b),
    q = (p: number) => sorted[Math.floor((sorted.length - 1) * p)];
  return {
    min: sorted[0],
    p10: q(0.1),
    p50: q(0.5),
    p90: q(0.9),
    max: sorted.at(-1)!,
  };
}
const summarize = (metrics: Metrics[]): Evidence =>
  Object.fromEntries(
    metricNames.map((key) => [key, distribution(metrics.map((m) => m[key]))]),
  ) as Evidence;
export function guardrails(
  plan: Plan,
  result: Pick<PreSimResult, "plan" | "baselines">,
) {
  return [
    {
      name: "Constitution passes every block and branch",
      pass: plan.constitution.ok,
    },
    {
      name: "Zero violations in every future",
      pass: result.plan.violations.max === 0,
    },
    {
      name: "Median PHL no worse than best baseline",
      pass:
        result.plan.phl.p50 <=
        Math.min(...result.baselines.map((b) => b.evidence.phl.p50)),
    },
    {
      name: "Hospital p10 minimum service ≥ 0.8",
      pass: result.plan.hospitalMin.p10 >= 0.8,
    },
  ];
}
export function* preSimulate(
  source: World,
  plan: Plan,
  nFutures = 30,
): Generator<number, PreSimResult> {
  const outcomes: Record<Strategy, Metrics[]> = {
      council: [],
      static: [],
      equal: [],
      optimum: [],
    },
    seeds: number[] = [],
    fanRuns: number[][] = [];
  for (let k = 0; k < nFutures; k++) {
    const seed = 1000 + k === source.config.seed ? 1001000 + k : 1000 + k;
    seeds.push(seed);
    const random = rng(seed),
      factor = 0.85 + random() * 0.3,
      dropRate = random() * 0.05;
    for (const strategy of [
      "council",
      "static",
      "equal",
      "optimum",
    ] as Strategy[]) {
      let world = structuredClone(source);
      // Historical actuals belong to execution only. Futures see forecasts.
      if (source.forecastDemand) world.observedDemand = source.forecastDemand;
      world.config.seed = seed;
      world.config.strategy = strategy;
      world.config.scenario.demandNoise = 0.1;
      world.config.scenario.dropRate = dropRate;
      world.config.scenario.timingJitter = 3;
      world.config.scenario.initialSupply *= factor;
      world.config.scenario.events = world.config.scenario.events.map((e) =>
        e.type === "supply" ? { ...e, value: e.value * factor } : e,
      );
      const ticks: Tick[] = [];
      for (let i = 0; i < plan.horizonTicks; i++) {
        const r = step(world, strategy === "council" ? plan : undefined);
        world = r.world;
        ticks.push(r.tick);
      }
      outcomes[strategy].push(windowMetrics(ticks));
      if (strategy === "council")
        fanRuns.push(
          ticks.map((_, i) => windowMetrics(ticks.slice(0, i + 1)).phl),
        );
    }
    yield (k + 1) / nFutures;
  }
  const result: PreSimResult = {
    planId: plan.id,
    nFutures,
    seeds,
    fan: Array.from({ length: plan.horizonTicks }, (_, i) => ({
      tick: plan.startTick + i,
      phl: distribution(fanRuns.map((run) => run[i])),
    })),
    plan: summarize(outcomes.council),
    baselines: (["static", "equal", "optimum"] as Strategy[]).map(
      (strategy) => ({ strategy, evidence: summarize(outcomes[strategy]) }),
    ),
    guardrails: [],
    autoApproved: false,
  };
  result.guardrails = guardrails(plan, result);
  result.autoApproved = result.guardrails.every((g) => g.pass);
  return result;
}
export function preSim(source: World, plan: Plan, nFutures = 30) {
  const generator = preSimulate(source, plan, nFutures);
  let r = generator.next();
  while (!r.done) r = generator.next();
  return r.value;
}
