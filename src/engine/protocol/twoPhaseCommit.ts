import type { AgentId, Allocation, Bid } from "../../contract/types";
import type { Constraints } from "./clearing";
import { validate } from "../constitution/invariants";
import { allocationHash, message } from "./messages";
import type { MessageBus } from "./bus";
export function twoPhaseCommit(
  candidates: Map<AgentId, Allocation>,
  bids: Bid[],
  c: Constraints,
  bus: MessageBus,
  t: number,
  attempt: number,
) {
  const ids = [...candidates.keys()].sort(),
    hashes = ids.map((id) => allocationHash(candidates.get(id)!));
  let delivered = true;
  for (const sender of ids)
    for (const recipient of ids)
      if (
        !bus.send(
          message({
            type: "PREPARE",
            sender,
            recipient,
            tick: t,
            round: 8,
            attempt,
            reason: "Prepare quantized allocation",
            hash: allocationHash(candidates.get(sender)!),
          }),
        )
      )
        delivered = false;
  const first = candidates.get(ids[0]);
  const report = first
    ? validate(first, bids, c, { kind: "commit", hashes, live: ids.length })
    : { ok: false, errors: ["No live participants"] };
  const physicalReports = [...candidates.values()].map((a) =>
    validate(a, bids, c),
  );
  const physicalErrors = [...new Set(physicalReports.flatMap((r) => r.errors))];
  const agreed = delivered && report.ok && !physicalErrors.length;
  for (const sender of ids)
    bus.send(
      message({
        type: agreed ? "COMMIT" : "ABORT",
        sender,
        recipient: "all",
        tick: t,
        round: 8,
        attempt,
        reason: agreed
          ? "Unanimous live hashes; Constitution passed"
          : !delivered
            ? "Prepare timeout"
            : [...report.errors, ...physicalErrors].join("; "),
        hash: hashes[ids.indexOf(sender)],
      }),
    );
  return {
    agreed,
    allocation: first,
    blocked: physicalErrors.length ? 1 : 0,
  };
}
