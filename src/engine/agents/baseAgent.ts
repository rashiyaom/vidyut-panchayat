import type { AgentId, Allocation, Bid, Profile } from "../../contract/types";
import { clear, type Constraints } from "../protocol/clearing";
import { valueFunction } from "./valueFunction";
export interface PrivateState {
  reserve: number;
  stress: number;
  lastBid: Bid | null;
  lastCommitted: number;
  starved: number;
  missed: number;
  reserveAlarm: boolean;
}
export class UtilityAgent {
  private received = new Map<AgentId, Bid>();
  constructor(
    readonly profile: Profile,
    private state: PrivateState,
  ) {}
  observe(demand: number, c: Constraints, bias: number): Bid {
    const f = c.network.feeders.find((f) => f.id === this.profile.id)!;
    const bid: Bid = {
      id: this.profile.id,
      demand,
      minimum: Math.min(demand, this.profile.minViable),
      value: valueFunction(
        this.profile,
        this.state.reserve,
        this.state.stress,
        bias,
      ),
      flexibility: this.profile.flexibility,
      reserveHours: this.state.reserve,
      bus: f.bus,
      cap: c.feederCaps[this.profile.id],
    };
    this.state.lastBid = bid;
    return bid;
  }
  receive(bid: Bid) {
    this.received.set(bid.id, bid);
  }
  candidate(c: Constraints) {
    return clear([...this.received.values()], c);
  }
  plannedCandidate(plan: Allocation, fixed: Allocation): Allocation {
    // A preapproved schedule still needs a current BID view; unknown managed
    // loads cannot silently participate in the local proposal.
    const proposal = { ...fixed };
    for (const id of this.received.keys()) proposal[id] = plan[id];
    return proposal;
  }
  commit(a: Allocation) {
    this.state.lastCommitted = a[this.profile.id];
  }
  snapshot() {
    return structuredClone(this.state);
  }
}
