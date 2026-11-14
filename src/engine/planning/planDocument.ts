import type { Plan } from "../../contract/types";
import { agentIds } from "../../contract/schemas";
import { hashText } from "../protocol/messages";
export function planHash(
  p: Pick<
    Plan,
    | "startTick"
    | "horizonTicks"
    | "blocks"
    | "contingencies"
    | "revision"
    | "note"
  >,
) {
  return hashText(
    JSON.stringify({
      startTick: p.startTick,
      horizonTicks: p.horizonTicks,
      blocks: p.blocks,
      contingencies: p.contingencies,
      revision: p.revision,
      note: p.note,
    }),
  );
}
export function planDocument(p: Plan, supplyFraction = 0.85): string {
  return [
    `Plan ${p.id} / hash ${p.hash}`,
    `Window: ticks ${p.startTick}–${p.startTick + p.horizonTicks - 1} (10 minutes/tick)`,
    `Constitution: ${p.constitution.ok ? "PASS" : "REJECTED"} — ${p.constitution.errors.join("; ") || "every block and contingency checked against pessimistic supply"}`,
    `Forecast: ${(supplyFraction * 100).toFixed(0)}% scheduled supply; demand bounded by the declared forecast envelope.`,
    "Allocation schedule (PU):",
    ...p.blocks.map(
      (b) =>
        `${b.fromTick}–${b.toTick} / supply floor ${b.supply.toFixed(2)}: ${agentIds.map((id) => `${id} ${b.allocations[id].toFixed(2)}`).join(", ")}`,
    ),
    "Protected services: agent minima are preferred when feasible; triage may reduce any minimum.",
    "Expected concessions (first block):",
    ...agentIds.map(
      (id) =>
        `${id}: ${(p.blocks[0].demands[id] - p.blocks[0].allocations[id]).toFixed(2)} PU below bounded demand`,
    ),
    "Risks: forecast error, dependency cascades, backup exhaustion and message loss. Safety does not guarantee adequate service.",
    "Contingencies:",
    ...p.contingencies.map(
      (c) => `${c.trigger}: ${c.action}; branch revalidated`,
    ),
    `Citizen note: ${p.note || "none"}`,
  ].join("\n");
}
