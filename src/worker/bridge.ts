import type { CommandInput, Config, Reply } from "../contract/types";
import { commandSchema, configSchema, replySchema } from "../contract/schemas";
import profiles from "../../data/agents/profiles.json";
import network from "../../data/network/electrical_v1.json";
import scenario from "../../data/scenarios/cyclone_24h.json";
export function defaultConfig(seed = 42): Config {
  return configSchema.parse({
    version: 1,
    seed,
    strategy: "council",
    profiles,
    network,
    scenario,
    enabledAgents: profiles.agents.map((p) => p.id),
  });
}
export class EngineBridge {
  private worker: Worker;
  private id = 0;
  private sequence = -1;
  private branch = 0;
  private failure: Error | null = null;
  private pending = new Map<
    number,
    { resolve: () => void; reject: (e: Error) => void }
  >();
  private listeners = new Set<(r: Reply) => void>();
  constructor() {
    this.worker = new Worker(new URL("./engine.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event) => {
      const parsed = replySchema.safeParse(event.data);
      if (!parsed.success) {
        this.fail(new Error(`Invalid worker reply: ${parsed.error.message}`));
        return;
      }
      const reply = parsed.data;
      if (reply.sequence <= this.sequence) return;
      this.sequence = reply.sequence;
      this.branch = reply.branch;
      for (const listener of this.listeners) listener(reply);
      const p = this.pending.get(reply.requestId);
      if (reply.type === "ACK") {
        p?.resolve();
        this.pending.delete(reply.requestId);
      } else if (reply.type === "ERROR") {
        p?.reject(new Error(reply.message));
        this.pending.delete(reply.requestId);
      }
    };
    this.worker.onerror = (e) => this.fail(new Error(e.message));
  }
  private fail(error: Error) {
    if (this.failure) return;
    this.failure = error;
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
    for (const l of this.listeners)
      l({
        type: "ERROR",
        requestId: this.id,
        branch: this.branch,
        sequence: ++this.sequence,
        message: error.message,
      });
  }
  subscribe(fn: (r: Reply) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  async send(input: CommandInput): Promise<void> {
    if (this.failure) throw this.failure;
    const command = commandSchema.parse({ ...input, requestId: ++this.id });
    return new Promise((resolve, reject) => {
      this.pending.set(command.requestId, { resolve, reject });
      this.worker.postMessage(command);
    });
  }
  dispose() {
    this.failure = new Error("Engine disposed");
    this.worker.terminate();
    for (const p of this.pending.values())
      p.reject(new Error("Engine disposed"));
    this.pending.clear();
    this.listeners.clear();
  }
}
