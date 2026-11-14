import type { GridTelemetry } from "./types";

/** Last completed hourly national load; later archival values stay hidden. */
export function gridLoadAt(telemetry: GridTelemetry | undefined, tick: number) {
  if (!telemetry || tick < 0 || tick >= 18) return undefined;
  return telemetry.samples[Math.floor(tick / 6)];
}
