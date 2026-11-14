import type {
  Plan,
  PlanState,
  PreSimResult,
  Reply,
  Tick,
  Verification,
} from "../contract/types";
export class CouncilStore {
  tick: Tick | null = null;
  history = new Map<number, Map<number, Tick>>();
  branch = 0;
  plan: Plan | null = null;
  presim: PreSimResult | null = null;
  verification: Verification | null = null;
  state: PlanState = "Idle";
  mode: "auto" | "human" = "human";
  running = false;
  progress = 0;
  error = "";
  apply(r: Reply) {
    if (r.branch !== this.branch) {
      const previous = this.history.get(this.branch);
      this.history.set(
        r.branch,
        new Map(
          [...(previous ?? new Map()).entries()].filter(
            ([t]) => t <= (this.tick?.t ?? -1),
          ),
        ),
      );
      this.branch = r.branch;
      this.plan = null;
      this.presim = null;
    }
    switch (r.type) {
      case "ACK":
        if (r.command === "INIT") {
          this.tick = null;
          this.history.clear();
          this.plan = null;
          this.presim = null;
          this.verification = null;
          this.error = "";
          this.progress = 0;
        }
        break;
      case "TICK":
        this.tick = r.tick;
        if (!this.history.has(r.branch)) this.history.set(r.branch, new Map());
        this.history.get(r.branch)!.set(r.tick.t, r.tick);
        break;
      case "PLAN_READY":
        this.plan = r.plan;
        this.presim = null;
        break;
      case "PRESIM_PROGRESS":
        this.progress = r.progress;
        break;
      case "PRESIM_DONE":
        this.presim = r.result;
        break;
      case "PLAN_STATE":
        if (r.state === "Idle") {
          this.plan = null;
          this.presim = null;
        }
        this.state = r.state;
        this.mode = r.mode;
        this.running = r.running;
        break;
      case "VERIFICATION":
        this.verification = r.verification;
        break;
      case "ERROR":
        this.error = r.message;
        this.running = false;
        break;
    }
  }
}
