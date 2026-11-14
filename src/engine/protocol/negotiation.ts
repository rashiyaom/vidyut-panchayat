import type { AgentId, Allocation, Bid, Trace } from "../../contract/types";
import { UtilityAgent } from "../agents/baseAgent";
import { concession } from "../agents/concession";
import { emptyAllocation, project, type Constraints } from "./clearing";
import { MessageBus } from "./bus";
import { allocationHash, message } from "./messages";
import { twoPhaseCommit } from "./twoPhaseCommit";
export function negotiate(
  agents: UtilityAgent[],
  bids: Bid[],
  allBids: Bid[],
  c: Constraints,
  full: Constraints,
  fixed: Allocation,
  previous: Allocation,
  t: number,
  seed: number,
  dropRate: number,
  forceDrop = false,
  planned?: Allocation,
) {
  const bus = new MessageBus(
    seed ^ Math.imul(t + 1, 7919),
    dropRate,
    forceDrop,
  );
  let applied = emptyAllocation();
  const trace: Trace = {
    messages: bus.trace,
    rounds: 0,
    aborts: 0,
    fallback: false,
    triage: [],
    prices: { east: 0, central: 0, west: 0 },
    hash: "",
    outcome: planned ? "plan" : "commit",
    blocked: 0,
  };
  if (!agents.length) {
    applied = fixed;
    trace.outcome = "fallback";
    trace.fallback = true;
    trace.hash = allocationHash(applied);
    return { allocation: applied, trace };
  }
  for (const a of agents)
    bus.send(
      message({
        type: "HEARTBEAT",
        sender: a.profile.id,
        recipient: "all",
        tick: t,
        round: 0,
        attempt: 0,
        reason: "Agent responsive",
      }),
    );
  for (let attempt = 0; attempt < 2; attempt++) {
    // New actors retain private state but obtain a fresh inbox at each retry.
    const participants = agents.map(
      (a) => new UtilityAgent(a.profile, a.snapshot()),
    );
    for (const bid of bids)
      for (const actor of participants)
        if (
          bus.send(
            message({
              type: "BID",
              sender: bid.id,
              recipient: actor.profile.id,
              tick: t,
              round: 0,
              attempt,
              reason: "Demand, minimum, value and reserve",
              bid,
            }),
          )
        )
          actor.receive(bid);
    const candidates = new Map<AgentId, Allocation>();
    for (const actor of participants) {
      const result = actor.candidate(c),
        own = bids.find((b) => b.id === actor.profile.id)!;
      let last = own.demand;
      if (!planned) {
        const phases = [
          { phase: "bus" as const, prices: result.busRounds[own.bus] },
          {
            phase: "root" as const,
            prices: result.rounds.map((p) =>
              Math.max(p, result.localPrices[own.bus]),
            ),
          },
        ];
        for (const search of phases)
          for (const [r, price] of search.prices.entries()) {
            const amount = concession(
              result.adjusted.find((b) => b.id === own.id)!,
              price,
            );
            const concedes = amount < last - 1e-7;
            bus.send(
              message({
                type: concedes ? "CONCEDE" : "COUNTER",
                sender: own.id,
                recipient: "all",
                tick: t,
                round: r + 1,
                attempt,
                phase: search.phase,
                reason: concedes
                  ? `Reserve ${own.reserveHours.toFixed(2)}h; ${search.phase} search feasible bound`
                  : `${search.phase} search feasible bound`,
                allocation: amount,
                price,
              }),
            );
            last = amount;
          }
      }
      const candidate = planned
        ? actor.plannedCandidate(planned, fixed)
        : (Object.fromEntries(
            Object.keys(fixed).map((id) => [
              id,
              fixed[id as AgentId] + result.allocation[id as AgentId],
            ]),
          ) as Allocation);
      if (planned)
        bus.send(
          message({
            type: "COUNTER",
            sender: own.id,
            recipient: "all",
            tick: t,
            round: 0,
            attempt,
            phase: "plan",
            reason: "Revalidate approved block against current received bids",
            allocation: candidate[own.id],
          }),
        );
      candidates.set(own.id, candidate);
      trace.rounds = planned
        ? 0
        : Math.max(
            trace.rounds,
            result.rounds.length,
            ...Object.values(result.busRounds).map((rounds) => rounds.length),
          );
      trace.prices = result.prices;
      trace.triage = [...new Set([...trace.triage, ...result.triage])];
      bus.send(
        message({
          type: "ACCEPT",
          sender: own.id,
          recipient: "all",
          tick: t,
          round: 8,
          attempt,
          reason: planned
            ? "Approved block candidate ready"
            : "Local candidate ready",
          hash: allocationHash(candidate),
          price: result.prices[own.bus],
        }),
      );
    }
    const result = twoPhaseCommit(candidates, allBids, full, bus, t, attempt);
    trace.blocked += result.blocked;
    if (result.agreed) {
      applied = result.allocation!;
      for (const a of agents) a.commit(applied);
      trace.hash = allocationHash(applied);
      return { allocation: applied, trace };
    }
    trace.aborts++;
  }
  const free = project(previous, bids, c);
  applied = Object.fromEntries(
    Object.keys(fixed).map((id) => [
      id,
      fixed[id as AgentId] + free[id as AgentId],
    ]),
  ) as Allocation;
  trace.fallback = true;
  trace.outcome = "fallback";
  trace.hash = allocationHash(applied);
  return { allocation: applied, trace };
}
