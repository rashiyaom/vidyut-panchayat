import { EngineRuntime } from "./runtime";
const runtime = new EngineRuntime((reply) => postMessage(reply));
// Runtime owns the single queue for both messages and timer callbacks.
self.onmessage = (event: MessageEvent<unknown>) => {
  void runtime.handle(event.data);
};
self.onerror = () => runtime.dispose();
