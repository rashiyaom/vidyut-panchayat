import type { AgentTick, Profile } from "../contract/types";
export function dependencyStress(p: Profile, previous: AgentTick[]) {
  return p.dependsOn.reduce(
    (s, d) =>
      s +
      d.weight * (1 - (previous.find((a) => a.id === d.agent)?.service ?? 1)),
    0,
  );
}
export function effectiveService(
  p: Profile,
  own: number,
  previous: AgentTick[],
) {
  return (
    own *
    p.dependsOn.reduce(
      (s, d) =>
        s *
        (1 -
          d.weight *
            (1 - (previous.find((a) => a.id === d.agent)?.service ?? 1))),
      1,
    )
  );
}
