import type { Config, CommandInput, Tick } from "../contract/types";
import { CouncilStore } from "../app/store";
import { metricsPanel, number } from "./MetricsPanel";
import { timeline } from "./Timeline";
import { agentToggles } from "./AgentToggles";
import { negotiationFeed } from "./NegotiationFeed";
import { planDocument } from "./PlanDocument";
import { approvalBar } from "./ApprovalBar";
import { preSimPanel, drawPreSim, drawFan } from "./PreSimPanel";
import { verificationPanel } from "./VerificationPanel";
import { togglePresenter } from "./Presenter";
export function mountCouncil(
  config: Config,
  store: CouncilStore,
  send: (c: CommandInput) => void,
  onCompare: (strategy: string) => void,
) {
  const root = document.createElement("aside");
  root.className = "council glass";
  root.id = "council";
  root.innerHTML = `<header><div><span class="eyebrow">VIDYUT PANCHAYAT</span><h2>Utility council</h2></div><button id="council-collapse" aria-label="Collapse council">−</button></header><div class="council-body"><div id="sim-error" role="alert" hidden></div><div class="sim-actions"><button data-action="run">Run</button><button data-action="step">Step</button><button data-action="plan">Plan</button><select id="sim-mode" aria-label="Approval mode"><option value="human">Human approval</option><option value="auto">Auto guardrails</option></select></div><div id="sim-metrics"></div><div id="sim-timeline"></div><details open><summary>Plan & approval</summary><div id="sim-approval"></div><textarea id="rejection-note" placeholder="Reason for rejection" aria-label="Rejection note"></textarea><div id="sim-presim"></div><details><summary>Read exact proposal</summary><div id="sim-plan"></div></details></details><details><summary>Ten utilities & participation</summary><div id="sim-agents"></div></details><details><summary>Electrical feeders</summary><div id="sim-lines"></div></details><details><summary>Actual negotiation messages</summary><div id="sim-messages"></div></details><details><summary>Verification</summary><div id="sim-verification"></div></details><details><summary>Inject a disruption</summary><div class="sim-actions"><button data-action="collapse">Supply 55 PU</button><button data-action="feeder">Central cap 30</button><button data-action="drop">Drop bids</button><button data-action="crash">Crash telecom</button></div></details><div class="sim-actions"><select id="sim-baseline" aria-label="Comparison baseline"><option value="off">Single city</option><option value="static">Compare static priority</option><option value="equal">Compare equal split</option><option value="optimum">Compare exact optimum</option></select><button data-action="present">Presenter</button></div><div id="sim-comparison"></div><p class="council-note">Synthetic exposures overlap. Modelled service loss, not casualties. Seed ${config.seed} · <span id="sim-branch">branch 0</span></p></div>`;
  document.querySelector("#app")!.append(root);
  const el = (id: string) => document.getElementById(id)!;
  el("council-collapse").onclick = () => root.classList.toggle("collapsed");
  root.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    );
    if (!button || button.disabled) return;
    const t = (store.tick?.t ?? -1) + 1;
    switch (button.dataset.action) {
      case "run":
        send(store.running ? { type: "PAUSE" } : { type: "RUN", speed: 1 });
        break;
      case "step":
        send({ type: "STEP" });
        break;
      case "plan":
        send({ type: "REQUEST_PLAN", horizonTicks: 18 });
        break;
      case "approve":
        if (store.plan)
          send({
            type: "APPROVE",
            planId: store.plan.id,
            hash: store.plan.hash,
          });
        break;
      case "reject":
        if (store.plan)
          send({
            type: "REJECT",
            planId: store.plan.id,
            note:
              (el("rejection-note") as HTMLTextAreaElement).value.trim() ||
              "Please reconsider service protection.",
          });
        break;
      case "collapse":
        send({
          type: "TRIGGER_EVENT",
          event: {
            type: "supply",
            tick: t,
            value: 55,
            label: "Injected supply collapse",
          },
        });
        break;
      case "feeder":
        send({
          type: "TRIGGER_EVENT",
          event: {
            type: "bus",
            tick: t,
            id: "central",
            value: 30,
            label: "Injected Central failure",
          },
        });
        break;
      case "drop":
        send({
          type: "TRIGGER_EVENT",
          event: { type: "drop", tick: t, label: "Injected message loss" },
        });
        break;
      case "crash":
        send({
          type: "TRIGGER_EVENT",
          event: {
            type: "crash",
            tick: t,
            id: "telecom",
            duration: 3,
            label: "Injected telecom crash",
          },
        });
        break;
      case "present":
        togglePresenter();
        break;
    }
  });
  root.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.id === "sim-seek")
      send({ type: "SEEK", tick: Number(input.value) });
    if (input.dataset.agent)
      send({
        type: "TOGGLE_AGENT",
        id: input.dataset.agent as Config["enabledAgents"][number],
        enabled: input.checked,
      });
    if (input.id === "sim-mode")
      send({ type: "SET_MODE", mode: input.value as "auto" | "human" });
    if (input.id === "sim-baseline") onCompare(input.value);
  });
  return {
    render() {
      const t = store.tick;
      el("sim-metrics").innerHTML = metricsPanel(t);
      el("sim-timeline").innerHTML = timeline(
        [...(store.history.get(store.branch)?.values() ?? [])],
        t,
      );
      el("sim-approval").innerHTML = approvalBar(store);
      el("sim-agents").innerHTML = agentToggles(config, t);
      el("sim-lines").innerHTML = t
        ? `<table>${t.lines.map((l) => `<tr><td>${l.id}</td><td>${l.flow.toFixed(1)} / ${l.capacity.toFixed(1)} PU</td><td>p ${l.price.toFixed(1)}</td></tr>`).join("")}</table>`
        : "";
      el("sim-messages").innerHTML = negotiationFeed(t);
      el("sim-plan").innerHTML = planDocument(store.plan);
      el("sim-presim").innerHTML = preSimPanel(store.presim);
      drawPreSim(document.querySelector("#presim-chart"), store.presim);
      drawFan(document.querySelector("#presim-fan"), store.presim);
      el("sim-verification").innerHTML = verificationPanel(store.verification);
      el("sim-branch").textContent = `branch ${store.branch}`;
      el("sim-error").hidden = !store.error;
      el("sim-error").textContent = store.error;
      root.querySelector('[data-action="run"]')!.textContent = store.running
        ? "Pause"
        : "Run";
    },
    comparison(a: Tick, b: Tick) {
      el("sim-comparison").innerHTML =
        `<table><caption>Same seed ${a.seed}, tick ${a.t} · synthetic PHL</caption><thead><tr><th>Council</th><th>${b.strategy}</th></tr></thead><tbody><tr><td>${number(a.metrics.phl)}</td><td>${number(b.metrics.phl)}</td></tr><tr><td>Harm ${a.metrics.damage.toFixed(2)}</td><td>Harm ${b.metrics.damage.toFixed(2)}</td></tr></tbody></table>`;
    },
  };
}
