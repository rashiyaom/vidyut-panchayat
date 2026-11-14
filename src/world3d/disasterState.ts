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

/** Demonstration warnings inferred from committed service, not council evacuation orders. */
export function disasterWarnings(tick: Tick | null) {
  if (!tick) return [];
  const service = (id: string) =>
    tick.agents.find((a) => a.id === id)?.service ?? 1;
  const warnings: { id: string; title: string; detail: string }[] = [];
  if (service("residential") < 0.45)
    warnings.push({
      id: "residential",
      title: "Residential · evacuation demonstration",
      detail:
        "Residents run to marked sidewalk assembly points. These are illustrative gathering places, not verified safe sites.",
    });
  if (service("transit") < 0.2)
    warnings.push({
      id: "transit",
      title: "Transit · services halted",
      detail:
        "Council allocation and dependencies leave transit below 20% service. Trains and buses are stopped.",
    });
  else if (service("transit") < 0.85)
    warnings.push({
      id: "transit",
      title: "Transit · reduced service",
      detail:
        "Trains and buses slow as transit service falls. They recover as service returns.",
    });
  if (service("shelter") < 0.5)
    warnings.push({
      id: "shelter",
      title: "Shelter · service limited",
      detail:
        "Shelter utilities are disrupted. The model does not confirm shelter capacity or a safe evacuation destination.",
    });
  else if (service("traffic") < 0.5)
    warnings.push({
      id: "traffic",
      title: "Roads · signal disruption",
      detail:
        "Traffic slows and stops. Amber hazard lights identify disrupted vehicles.",
    });
  return warnings;
}
