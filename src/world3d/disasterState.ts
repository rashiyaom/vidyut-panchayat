import type { Tick } from "../contract/types";
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Illustrative street behaviour; never feeds back into the utility model. */
export function disasterState(tick: Tick | null, initialSupply = 200) {
  const service = (id: string) =>
    clamp(tick?.agents.find((a) => a.id === id)?.service ?? 1);
  const shortage = tick
    ? clamp(1 - tick.supply / Math.max(1, initialSupply))
    : 0;
  const severity = tick
    ? Math.max(
        shortage,
        1 - service("traffic"),
        1 - service("transit"),
        1 - service("residential"),
      )
    : 0;
  const active = severity > 0.15;
  const transit = service("transit");
  return {
    active,
    severity,
    rain: tick?.scenario === "cyclone_24h" && active ? shortage : 0,
    carSpeed: active
      ? Math.max(0.08, service("traffic") * (1 - severity * 0.65))
      : 1,
    busSpeed: active ? (transit < 0.2 ? 0 : transit * (1 - severity * 0.5)) : 1,
    trainSpeed: active
      ? transit < 0.2
        ? 0
        : transit * (1 - severity * 0.3)
      : 1,
    pedestrianSpeed: active ? 1 + severity * 1.8 : 1,
    gathering: active && severity > 0.4,
  };
}
export type DisasterState = ReturnType<typeof disasterState>;
