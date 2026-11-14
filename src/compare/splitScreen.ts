import type { CommandInput, Config, Tick, Strategy } from "../contract/types";
import { EngineBridge } from "../worker/bridge";
type ComparisonBridge = Pick<EngineBridge, "send" | "subscribe" | "dispose">;
export class SplitComparison {
  private cursor = -1;
  private history = new Map<number, Tick>();
  private interventions: { t: number; command: CommandInput }[] = [];
  private serial: Promise<void> = Promise.resolve();
  private revision = 0;
  private loadedRevision = -1;
  private disposed = false;
  strategy: Strategy = "static";
  constructor(
    private config: Config,
    private onTick: (tick: Tick) => void,
    private bridge: ComparisonBridge = new EngineBridge(),
  ) {
    this.config = structuredClone(config);
    this.bridge.subscribe((r) => {
      if (r.type === "TICK") {
        this.history.set(r.tick.t, r.tick);
        this.cursor = r.tick.t;
      }
    });
  }
  setStrategy(strategy: Strategy) {
    this.strategy = strategy;
    this.revision++;
  }
  intervene(command: CommandInput, t: number) {
    this.interventions = this.interventions.filter((i) => i.t <= t);
    this.interventions.push({ t, command: structuredClone(command) });
    this.revision++;
  }
  sync(target: number): Promise<void> {
    const revision = this.revision;
    const task = this.serial.then(async () => {
      const stale = () => this.disposed || revision !== this.revision;
      if (stale()) return;
      if (this.loadedRevision !== revision) {
        await this.bridge.send({
          type: "INIT",
          config: { ...this.config, strategy: this.strategy },
        });
        if (stale()) return;
        this.history.clear();
        this.cursor = -1;
        this.loadedRevision = revision;
      }
      if (this.history.has(target)) {
        this.onTick(this.history.get(target)!);
        return;
      }
      while (this.cursor < target) {
        for (const intervention of this.interventions.filter(
          (i) => i.t === this.cursor + 1,
        )) {
          await this.bridge.send(intervention.command);
          if (stale()) return;
        }
        await this.bridge.send({ type: "STEP" });
        if (stale()) return;
      }
      const tick = this.history.get(target);
      if (tick) this.onTick(tick);
    });
    // A failed request rejects its caller but cannot poison future sync jobs.
    this.serial = task.catch(() => {
      this.loadedRevision = -1;
    });
    return task;
  }
  dispose() {
    this.disposed = true;
    this.revision++;
    this.bridge.dispose();
  }
}
