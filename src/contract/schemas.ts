import { z } from "zod";
export const VERSION = 1;
export const ENGINE_VERSION = "1.1.0";
export const agentIds = [
  "commercial",
  "emergency",
  "fuel",
  "hospital",
  "residential",
  "shelter",
  "telecom",
  "traffic",
  "transit",
  "water",
] as const;
export const idSchema = z.enum(agentIds);
const n = z.number().finite().nonnegative();
const ratio = n.max(1);
const tickIndex = z.number().int().min(0).max(143);
export const allocationSchema = z.record(idSchema, n);
export const weatherForecastSchema = z.object({
  originPortugal: z.string().datetime({ offset: true }),
  windSpeed: z.array(n).length(3),
  precipitation: z.array(n).length(3),
});
export const strategySchema = z.enum(["council", "static", "equal", "optimum"]);
export const busSchema = z.enum(["east", "central", "west"]);
export const profileSchema = z
  .object({
    id: idSchema,
    facilityId: idSchema,
    label: z.string(),
    tier: z.number().int().min(1).max(3),
    weight: ratio,
    demand: n.positive(),
    minViable: n,
    flexibility: ratio,
    exposure: n,
    reserve: z
      .object({
        kind: z.enum(["diesel", "battery"]),
        hours: n,
        refillPerHour: n,
        coverage: ratio,
      })
      .nullable(),
    dependsOn: z.array(z.object({ agent: idSchema, weight: ratio })),
  })
  .refine(
    (p) =>
      p.minViable <= p.demand &&
      p.id === p.facilityId &&
      !p.dependsOn.some((d) => d.agent === p.id),
    "Invalid minimum, mapping or self dependency",
  );
export const profilesSchema = z
  .object({
    version: z.literal(1),
    unit: z.literal("PU"),
    agents: z.array(profileSchema).length(10),
  })
  .refine(
    (p) => new Set(p.agents.map((a) => a.id)).size === 10,
    "Duplicate agent IDs",
  );
export const networkSchema = z
  .object({
    version: z.literal(1),
    root: z.literal("substation"),
    buses: z.array(z.object({ id: busSchema, capacity: n })).length(3),
    feeders: z
      .array(z.object({ id: idSchema, bus: busSchema, capacity: n }))
      .length(10),
  })
  .refine(
    (s) =>
      new Set(s.buses.map((b) => b.id)).size === 3 &&
      new Set(s.feeders.map((f) => f.id)).size === 10,
    "Duplicate network IDs",
  );
export const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("supply"),
    tick: tickIndex,
    value: n,
    label: z.string(),
  }),
  z.object({
    type: z.literal("bus"),
    tick: tickIndex,
    id: busSchema,
    value: n,
    label: z.string(),
  }),
  z.object({
    type: z.literal("feeder"),
    tick: tickIndex,
    id: idSchema,
    value: n,
    label: z.string(),
  }),
  z.object({
    type: z.literal("demand"),
    tick: tickIndex,
    id: idSchema,
    value: n.positive(),
    label: z.string(),
  }),
  z.object({
    type: z.literal("crash"),
    tick: tickIndex,
    id: idSchema,
    duration: z.number().int().positive().max(144),
    label: z.string(),
  }),
  z.object({
    type: z.literal("flood"),
    tick: tickIndex,
    id: z.literal("fuel"),
    label: z.string(),
  }),
  z.object({ type: z.literal("drop"), tick: tickIndex, label: z.string() }),
]);
export const scenarioSchema = z
  .object({
    version: z.literal(1),
    id: z.literal("cyclone_24h"),
    ticks: z.literal(144),
    tickMinutes: z.literal(10),
    initialSupply: n,
    demandNoise: ratio,
    dropRate: ratio.max(0.05),
    timingJitter: z.number().int().min(0).max(3),
    events: z.array(eventSchema),
  })
  .refine(
    (s) => s.events.every((e, i) => !i || e.tick >= s.events[i - 1].tick),
    "Events must be ordered",
  );
export const configSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(0).max(4294967295),
    strategy: strategySchema,
    profiles: profilesSchema,
    network: networkSchema,
    scenario: scenarioSchema,
    enabledAgents: z.array(idSchema),
  })
  .refine(
    (c) => new Set(c.enabledAgents).size === c.enabledAgents.length,
    "Duplicate enabled IDs",
  );
export const bidSchema = z.object({
  id: idSchema,
  demand: n,
  minimum: n,
  value: n,
  flexibility: ratio,
  reserveHours: n,
  bus: busSchema,
  cap: n,
});
export const messageSchema = z.object({
  type: z.enum([
    "BID",
    "COUNTER",
    "CONCEDE",
    "ACCEPT",
    "PREPARE",
    "COMMIT",
    "ABORT",
    "HEARTBEAT",
  ]),
  sender: idSchema,
  recipient: z.union([idSchema, z.literal("all")]),
  tick: tickIndex,
  round: z.number().int().nonnegative(),
  attempt: z.number().int().min(0).max(1),
  phase: z.enum(["bus", "root", "plan"]).optional(),
  reason: z.string(),
  delivered: z.boolean(),
  bid: bidSchema.optional(),
  allocation: n.optional(),
  price: n.optional(),
  hash: z.string().optional(),
});
export const reportSchema = z.object({
  ok: z.boolean(),
  errors: z.array(z.string()),
});
export const traceSchema = z.object({
  messages: z.array(messageSchema),
  rounds: n,
  aborts: n,
  fallback: z.boolean(),
  triage: z.array(idSchema),
  prices: z.record(busSchema, n),
  hash: z.string(),
  outcome: z.enum(["commit", "fallback", "baseline", "plan"]),
  blocked: n,
});
export const agentTickSchema = z.object({
  id: idSchema,
  demand: n,
  allocated: n,
  reserveHours: n,
  reserveCapacity: n,
  ownService: ratio,
  service: ratio,
  backup: ratio,
  dependencyStress: n,
  status: z.enum(["ok", "rationed", "critical", "down"]),
  isDown: z.boolean(),
  enabled: z.boolean(),
  missedHeartbeats: n,
  harm: n,
  exposure: n,
  tier: n,
  weight: ratio,
});
export const metricsSchema = z.object({
  phl: n,
  damage: n,
  criticalUptime: ratio,
  hospitalMin: ratio,
  fairness: ratio,
  weightedService: n,
  violations: n,
  blocked: n,
  aborts: n,
  fallbacks: n,
  adherence: ratio,
});
export const lineSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  flow: n,
  capacity: n,
  price: n,
});
export const tickSchema = z
  .object({
    version: z.literal(1),
    t: tickIndex,
    hour: n,
    seed: n,
    scenario: z.string(),
    strategy: strategySchema,
    supply: n,
    events: z.array(z.string()),
    agents: z.array(agentTickSchema).length(10),
    lines: z.array(lineSchema).length(13),
    negotiation: traceSchema,
    metrics: metricsSchema,
    constitution: reportSchema,
  })
  .refine(
    (t) =>
      new Set(t.agents.map((a) => a.id)).size === 10 &&
      new Set(t.lines.map((l) => l.id)).size === 13,
    "Duplicate tick agent or line IDs",
  );
export const planBlockSchema = z
  .object({
    fromTick: tickIndex,
    toTick: tickIndex,
    allocations: allocationSchema,
    supply: n,
    busCaps: z.record(busSchema, n),
    feederCaps: allocationSchema,
    demands: allocationSchema,
  })
  .refine((b) => b.toTick >= b.fromTick, "Reversed plan block");
export const planSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  hash: z.string(),
  revision: n,
  startTick: tickIndex,
  horizonTicks: z.number().int().min(1).max(18),
  blocks: z.array(planBlockSchema).min(1),
  contingencies: z.array(
    z.object({
      trigger: z.string(),
      action: z.literal("renegotiate"),
      blocks: z.array(planBlockSchema),
    }),
  ),
  constitution: reportSchema,
  document: z.string(),
  note: z.string(),
});
export const distributionSchema = z
  .object({ min: n, p10: n, p50: n, p90: n, max: n })
  .refine(
    (d) => d.min <= d.p10 && d.p10 <= d.p50 && d.p50 <= d.p90 && d.p90 <= d.max,
    "Invalid quantiles",
  );
export const evidenceSchema = z.object({
  phl: distributionSchema,
  damage: distributionSchema,
  hospitalMin: distributionSchema,
  fairness: distributionSchema,
  violations: distributionSchema,
});
export const presimSchema = z.object({
  planId: z.string(),
  nFutures: z.number().int().min(1).max(100),
  seeds: z.array(n),
  fan: z.array(z.object({ tick: tickIndex, phl: distributionSchema })),
  plan: evidenceSchema,
  baselines: z.array(
    z.object({ strategy: strategySchema, evidence: evidenceSchema }),
  ),
  guardrails: z.array(z.object({ name: z.string(), pass: z.boolean() })),
  autoApproved: z.boolean(),
});
export const verificationSchema = z.object({
  planId: z.string(),
  result: z.enum(["PASS", "DRIFT", "FAIL"]),
  checks: z.array(
    z.object({
      metric: z.string(),
      actual: n,
      p10: n,
      p90: n,
      min: n,
      max: n,
      result: z.enum(["PASS", "DRIFT", "FAIL"]),
    }),
  ),
});
export const stateSchema = z.enum([
  "Idle",
  "Negotiating",
  "Validating",
  "PreSimulating",
  "AwaitingHuman",
  "AutoApproved",
  "Executing",
  "Verifying",
]);
const base = { requestId: z.number().int().nonnegative() };
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("INIT"), config: configSchema,
    historicalReplay: z.object({
      origin: z.string(),
      modelSha256: z.string().regex(/^[0-9a-f]{64}$/),
      actualDemand: z.array(allocationSchema).length(18),
      forecastDemand: z.array(allocationSchema).length(18),
      supplyFraction: z.literal(1),
      fillFraction: z.number().min(0).max(1).optional(),
      priorityBlend: z.number().min(0).max(1).optional(),
      weatherForecast: weatherForecastSchema.optional(),
    }).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("RUN"),
    speed: z.number().min(0.25).max(8),
  }),
  ...(["PAUSE", "STEP"] as const).map((type) =>
    z.object({ ...base, type: z.literal(type) }),
  ),
  z.object({ ...base, type: z.literal("SEEK"), tick: tickIndex }),
  z.object({
    ...base,
    type: z.literal("TOGGLE_AGENT"),
    id: idSchema,
    enabled: z.boolean(),
  }),
  z.object({ ...base, type: z.literal("TRIGGER_EVENT"), event: eventSchema }),
  z.object({
    ...base,
    type: z.literal("SET_MODE"),
    mode: z.enum(["auto", "human"]),
  }),
  z.object({
    ...base,
    type: z.literal("REQUEST_PLAN"),
    horizonTicks: z.number().int().min(1).max(18),
  }),
  z.object({
    ...base,
    type: z.literal("REQUEST_PRESIM"),
    planId: z.string(),
    nFutures: z.number().int().min(1).max(100),
  }),
  z.object({
    ...base,
    type: z.literal("APPROVE"),
    planId: z.string(),
    hash: z.string(),
  }),
  z.object({
    ...base,
    type: z.literal("REJECT"),
    planId: z.string(),
    note: z.string().min(1).max(1000),
  }),
]);
const replyBase = {
  ...base,
  branch: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
};
export const replySchema = z.discriminatedUnion("type", [
  z.object({ ...replyBase, type: z.literal("TICK"), tick: tickSchema }),
  z.object({ ...replyBase, type: z.literal("PLAN_READY"), plan: planSchema }),
  z.object({
    ...replyBase,
    type: z.literal("PRESIM_PROGRESS"),
    progress: ratio,
  }),
  z.object({
    ...replyBase,
    type: z.literal("PRESIM_DONE"),
    result: presimSchema,
  }),
  z.object({
    ...replyBase,
    type: z.literal("PLAN_STATE"),
    state: stateSchema,
    mode: z.enum(["auto", "human"]),
    running: z.boolean(),
  }),
  z.object({
    ...replyBase,
    type: z.literal("VERIFICATION"),
    verification: verificationSchema,
  }),
  z.object({ ...replyBase, type: z.literal("ACK"), command: z.string() }),
  z.object({ ...replyBase, type: z.literal("ERROR"), message: z.string() }),
]);
