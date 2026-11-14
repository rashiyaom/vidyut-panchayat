import type {
  Command,
  Config,
  Plan,
  PlanState,
  PreSimResult,
  Reply,
  Tick,
} from "../contract/types";
import { commandSchema } from "../contract/schemas";
import { initialWorld, step, type World } from "../engine/world";
import { createPlan } from "../engine/planning/planner";
import { preSimulate } from "../engine/planning/presim";
import { validatePlan } from "../engine/constitution/planValidator";
import { planHash } from "../engine/planning/planDocument";
import { verify } from "../engine/planning/verify";
import { windowMetrics } from "../engine/metrics/scoring";
type Payload = Reply extends infer R
  ? R extends Reply
    ? Omit<R, "requestId" | "branch" | "sequence">
    : never
  : never;
interface Branch {
  worlds: World[];
  ticks: Tick[];
}
export class EngineRuntime {
  private world: World | null = null;
  readonly branches = new Map<number, Branch>();
  branch = 0;
  private sequence = 0;
  private requestId = 0;
  private cursor = -1;
  private plan: Plan | null = null;
  private evidence: PreSimResult | null = null;
  private revision = 0;
  private state: PlanState = "Idle";
  private mode: "auto" | "human" = "human";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private speed = 1;
  private drift = 0;
  private escalated = false;
  private epoch = 0;
  private queue = Promise.resolve();
  constructor(
    private emit: (reply: Reply) => void,
    private yieldTask: () => Promise<void> = () =>
      new Promise((resolve) => setTimeout(resolve, 0)),
  ) {}
  private send(payload: Payload) {
    this.emit({
      ...payload,
      requestId: this.requestId,
      branch: this.branch,
      sequence: ++this.sequence,
    } as Reply);
  }
  private stateTo(state: PlanState) {
    this.state = state;
    this.send({
      type: "PLAN_STATE",
      state,
      mode: this.mode,
      running: this.running,
    });
  }
  private stop() {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.epoch++;
  }
  dispose() {
    this.stop();
  }
  private needWorld() {
    if (!this.world) throw new Error("Initialize the engine first");
    return this.world;
  }
  private fork() {
    const old = this.branches.get(this.branch)!;
    this.stop();
    this.branch = Math.max(...this.branches.keys()) + 1;
    this.branches.set(this.branch, {
      worlds: old.worlds.slice(0, this.cursor + 2),
      ticks: old.ticks.slice(0, this.cursor + 1),
    });
    this.world = structuredClone(this.needWorld());
    this.plan = null;
    this.evidence = null;
    this.stateTo("Idle");
  }
  private async draft(horizon = 18, note = "", resume = this.running) {
    this.stop();
    this.plan = null;
    this.evidence = null;
    this.drift = 0;
    this.stateTo("Negotiating");
    const plan = createPlan(this.needWorld(), horizon, ++this.revision, note);
    this.stateTo("Validating");
    if (!plan.constitution.ok)
      throw new Error(plan.constitution.errors.join("; "));
    this.plan = plan;
    this.send({ type: "PLAN_READY", plan });
    await this.presim(plan.id, 30);
    if (resume && this.state === "Executing") {
      this.running = true;
      this.stateTo(this.state);
      this.schedule();
    }
  }
  private async presim(planId: string, n: number) {
    const plan = this.plan;
    if (!plan || plan.id !== planId || plan.startTick !== this.needWorld().t)
      throw new Error("Stale plan requested");
    this.stop();
    this.stateTo("PreSimulating");
    const generator = preSimulate(this.needWorld(), plan, n);
    let next = generator.next();
    while (!next.done) {
      this.send({ type: "PRESIM_PROGRESS", progress: next.value });
      await this.yieldTask();
      next = generator.next();
    }
    this.evidence = next.value;
    this.send({ type: "PRESIM_DONE", result: next.value });
    if (this.mode === "auto" && next.value.autoApproved && !this.escalated) {
      this.stateTo("AutoApproved");
      this.stateTo("Executing");
    } else this.stateTo("AwaitingHuman");
  }
  private schedule() {
    if (!this.running || this.timer !== null) return;
    const epoch = this.epoch;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (epoch !== this.epoch || !this.running) return;
      this.queue = this.queue
        .then(async () => {
          if (epoch !== this.epoch || !this.running) return;
          await this.advance();
          this.schedule();
        })
        .catch((error) => {
          this.stop();
          this.send({ type: "ERROR", message: String(error) });
          this.stateTo(this.state);
        });
    }, 1000 / this.speed);
  }
  private async advance() {
    const w = this.needWorld(),
      branch = this.branches.get(this.branch)!;
    if (this.cursor + 1 < branch.ticks.length) {
      this.cursor++;
      this.world = structuredClone(branch.worlds[this.cursor + 1]);
      this.send({ type: "TICK", tick: branch.ticks[this.cursor] });
      return;
    }
    if (w.t >= 144) {
      this.stop();
      this.stateTo("Idle");
      return;
    }
    if (w.replayEndTick !== undefined && w.t >= w.replayEndTick) {
      this.stop();
      this.stateTo("Idle");
      return;
    }
    if (w.config.strategy === "council" && !this.plan) {
      await this.draft();
      return;
    }
    if (w.config.strategy === "council" && this.state !== "Executing")
      throw new Error(
        "Review evidence and approve the current plan before advancing",
      );
    const result = step(w, this.plan ?? undefined);
    this.world = result.world;
    this.cursor = result.tick.t;
    branch.ticks.push(result.tick);
    branch.worlds.push(structuredClone(result.world));
    this.send({ type: "TICK", tick: result.tick });
    if (this.plan) {
      this.drift =
        result.tick.negotiation.outcome === "plan" ? 0 : this.drift + 1;
      if (result.world.t >= this.plan.startTick + this.plan.horizonTicks) {
        const resume = this.running;
        this.stop();
        this.stateTo("Verifying");
        const actual = windowMetrics(
          branch.ticks.filter((t) => t.t >= this.plan!.startTick),
        );
        if (this.evidence) {
          const verification = verify(this.evidence, actual);
          this.escalated = verification.result === "FAIL";
          this.send({ type: "VERIFICATION", verification });
        }
        this.plan = null;
        this.evidence = null;
        this.stateTo("Idle");
        if (result.world.t < (result.world.replayEndTick ?? 144))
          await this.draft(18, "", resume);
      } else if (this.drift >= 2 && result.world.replayEndTick === undefined) {
        await this.draft(
          18,
          "Persistent contingency: negotiated allocations diverged from the approved schedule.",
        );
      }
    }
  }
  handle(input: unknown): Promise<void> {
    this.queue = this.queue.then(() => this.process(input));
    return this.queue;
  }
  private async process(input: unknown) {
    try {
      // Even malformed commands must reject the matching client promise.
      if (
        input &&
        typeof input === "object" &&
        "requestId" in input &&
        Number.isSafeInteger(input.requestId) &&
        Number(input.requestId) >= 0
      )
        this.requestId = Number(input.requestId);
      const command: Command = commandSchema.parse(input);
      this.requestId = command.requestId;
      if (command.type === "INIT") {
        this.stop();
        this.world = initialWorld(command.config);
        if (command.historicalReplay) {
          const replay = command.historicalReplay;
          this.world.observedDemand = Object.fromEntries(replay.actualDemand.entries());
          this.world.forecastDemand = Object.fromEntries(replay.forecastDemand.entries());
          this.world.planSupplyFraction = replay.supplyFraction;
          this.world.replayEndTick = 18;
        }
        this.branches.clear();
        this.branch = 0;
        this.cursor = -1;
        this.revision = 0;
        this.drift = 0;
        this.escalated = false;
        this.mode = "human";
        this.plan = null;
        this.evidence = null;
        this.branches.set(0, {
          worlds: [structuredClone(this.world)],
          ticks: [],
        });
        this.stateTo("Idle");
      } else {
        this.needWorld();
        switch (command.type) {
          case "PAUSE":
            this.stop();
            this.stateTo(this.state);
            break;
          case "RUN":
            if (
              this.state === "AwaitingHuman" ||
              this.state === "PreSimulating"
            )
              throw new Error("Approval required before running");
            if (
              !this.plan &&
              this.needWorld().config.strategy === "council" &&
              this.cursor + 1 >= this.branches.get(this.branch)!.ticks.length
            ) {
              await this.draft();
              if (this.state !== "Executing") break;
            }
            this.speed = command.speed;
            this.running = true;
            this.stateTo(this.state);
            this.schedule();
            break;
          case "STEP":
            this.stop();
            await this.advance();
            this.stateTo(this.state);
            break;
          case "SEEK": {
            this.stop();
            const history = this.branches.get(this.branch)!;
            if (!history.ticks[command.tick])
              throw new Error("Seek only to recorded ticks");
            this.cursor = command.tick;
            this.world = structuredClone(history.worlds[command.tick + 1]);
            this.plan = null;
            this.evidence = null;
            this.stateTo("Idle");
            this.send({ type: "TICK", tick: history.ticks[command.tick] });
            break;
          }
          case "TOGGLE_AGENT":
            this.fork();
            this.world!.config.enabledAgents =
              this.world!.config.enabledAgents.filter(
                (id) => id !== command.id,
              );
            if (command.enabled)
              this.world!.config.enabledAgents.push(command.id);
            this.branches.get(this.branch)!.worlds[this.cursor + 1] =
              structuredClone(this.world!);
            break;
          case "TRIGGER_EVENT":
            if (command.event.tick !== this.world!.t)
              throw new Error("Injected events must target the next tick");
            this.fork();
            this.world!.injected.push(command.event);
            this.branches.get(this.branch)!.worlds[this.cursor + 1] =
              structuredClone(this.world!);
            break;
          case "SET_MODE":
            this.mode = command.mode;
            if (
              this.mode === "auto" &&
              this.state === "AwaitingHuman" &&
              this.evidence?.autoApproved &&
              !this.escalated
            ) {
              this.stateTo("AutoApproved");
              this.stateTo("Executing");
            } else this.stateTo(this.state);
            break;
          case "REQUEST_PLAN":
            if (this.cursor + 1 < this.branches.get(this.branch)!.ticks.length)
              this.fork();
            await this.draft(command.horizonTicks);
            break;
          case "REQUEST_PRESIM":
            if (this.state === "Executing")
              throw new Error("Cannot replace evidence for an executing plan");
            await this.presim(command.planId, command.nFutures);
            break;
          case "APPROVE": {
            const p = this.plan;
            if (
              this.state !== "AwaitingHuman" ||
              !p ||
              !this.evidence ||
              p.id !== command.planId ||
              p.hash !== command.hash ||
              p.hash !== planHash(p) ||
              p.startTick !== this.world!.t ||
              !validatePlan(p, this.world!.config.network, this.world!).ok
            )
              throw new Error(
                "Approval rejected: stale, changed, illegal or unreviewed plan",
              );
            this.escalated = false;
            this.stateTo("Executing");
            break;
          }
          case "REJECT":
            if (
              this.state !== "AwaitingHuman" ||
              this.plan?.id !== command.planId
            )
              throw new Error("Cannot reject stale plan");
            await this.draft(18, command.note);
            break;
        }
      }
      this.send({ type: "ACK", command: command.type });
    } catch (error) {
      this.stop();
      this.send({
        type: "ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  getConfig(): Config {
    return structuredClone(this.needWorld().config);
  }
}
