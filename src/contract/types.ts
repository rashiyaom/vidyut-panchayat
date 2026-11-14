import type { z } from "zod";
import type * as s from "./schemas";
export type AgentId = z.infer<typeof s.idSchema>;
export type BusId = z.infer<typeof s.busSchema>;
export type Profile = z.infer<typeof s.profileSchema>;
export type Network = z.infer<typeof s.networkSchema>;
export type Scenario = z.infer<typeof s.scenarioSchema>;
export type ScenarioEvent = z.infer<typeof s.eventSchema>;
export type Config = z.infer<typeof s.configSchema>;
export type Strategy = z.infer<typeof s.strategySchema>;
export type Allocation = z.infer<typeof s.allocationSchema>;
export type WeatherForecast = z.infer<typeof s.weatherForecastSchema>;
export type Bid = z.infer<typeof s.bidSchema>;
export type Message = z.infer<typeof s.messageSchema>;
export type Trace = z.infer<typeof s.traceSchema>;
export type AgentTick = z.infer<typeof s.agentTickSchema>;
export type Tick = z.infer<typeof s.tickSchema>;
export type Metrics = z.infer<typeof s.metricsSchema>;
export type Report = z.infer<typeof s.reportSchema>;
export type Plan = z.infer<typeof s.planSchema>;
export type PlanBlock = z.infer<typeof s.planBlockSchema>;
export type Distribution = z.infer<typeof s.distributionSchema>;
export type Evidence = z.infer<typeof s.evidenceSchema>;
export type PreSimResult = z.infer<typeof s.presimSchema>;
export type Verification = z.infer<typeof s.verificationSchema>;
export type PlanState = z.infer<typeof s.stateSchema>;
export type Command = z.infer<typeof s.commandSchema>;
export type Reply = z.infer<typeof s.replySchema>;
export type CommandInput = Command extends infer C
  ? C extends Command
    ? Omit<C, "requestId">
    : never
  : never;
