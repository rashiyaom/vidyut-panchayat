import type { AgentId, CommandInput, Config, Tick } from "../contract/types";
import type { CouncilStore } from "../app/store";
import { createCouncilRoom } from "../world3d/councilRoom";
import {
  civicAdvisory,
  civicDiscussion,
  protocolDiscussion,
  readingTime,
  type CouncilTurn,
} from "./civicDiscussion";
import { escape } from "./NegotiationFeed";
import { decisionGuide } from "./DecisionGuide";
import { resultDashboard } from "./resultDashboard";
import "./councilExperience.css";
export function mountCouncilExperience(
  config: Config,
  store: CouncilStore,
  send: (c: CommandInput) => void,
  lifecycle: {
    enter: () => void;
    exit: () => void;
    impact: (visible: boolean) => void;
  },
) {
  const launcher = document.createElement("button");
  launcher.id = "enter-council";
  launcher.className = "council-launcher";
  launcher.setAttribute("aria-label", "Enter Panchayat disaster council");
  launcher.innerHTML =
    "<span>◉</span><b>Disaster council</b><small>Enter Panchayat Square</small>";
  document.querySelector("#app")!.append(launcher);
  const root = document.createElement("section");
  root.id = "council-experience";
  root.hidden = true;
  root.setAttribute("aria-label", "Panchayat disaster council");
  root.innerHTML = `<header class="chamber-header"><button id="leave-council">← Leave disaster mode</button><div><small>NAGAR / DISASTER OPERATIONS</small><h1>The Panchayat Chamber.</h1></div><div class="chamber-state" id="chamber-state"></div><button id="room-help" aria-expanded="false">How it works ?</button></header><div id="chamber-help" hidden><b>Follow the decision, then see its consequences.</b><p>1. Review the plan in Your decision. 2. Approve it using the action bar on any tab. 3. Advance ten simulated minutes. 4. Inspect the committed allocation in Collective result and City impact. The discussion is a replay; use Read all to view every message immediately.</p><p>Conversation replay only changes what messages you see. Simulation speed changes the disaster clock. Characters represent software utilities; their gestures are illustrative. City discussion is an authored scenario briefing informed by recorded service levels. Water-routing and public-safety actions are proposals, not executed operations. Protocol log preserves the actual electricity messages.</p></div><nav class="chamber-tabs" aria-label="Council views"><button data-room-tab="room" class="active">◉ Council room</button><button data-room-tab="chat">☷ Group conversation <span id="conversation-count">0</span></button><button data-room-tab="results">▥ Collective result</button><button data-room-tab="impact">↗ City impact</button><button data-room-tab="evidence">✓ Your decision</button></nav><div class="chamber-action" role="status"><span class="action-number" id="action-number">01</span><div><b id="action-title">Preparing a plan</b><small id="action-detail">The council is testing a proposed electricity schedule.</small></div><button id="action-review" hidden>Review plan ↗</button><button id="global-approve" hidden>Approve plan →</button></div><div class="chamber-content"><div id="room-stage"><canvas id="conference-canvas" aria-label="Round table. Drag to orbit, scroll to zoom, select a representative." tabindex="0"></canvas><div id="seat-labels"></div><div class="room-caption"><span>THE COUNCIL CHAMBER</span><p>Tap a representative to hear their case.</p></div><div class="room-camera"><button id="room-overview">Room view</button><button id="room-top">Overhead</button></div><button id="speaker-toggle" type="button" aria-label="Show current message" aria-expanded="false" aria-controls="speaker-bubble" title="Show current message"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-4 3 1.5-6A8 8 0 1 1 20 11.5Z"/><path d="M6 9h10M6 13h7"/></svg></button><aside id="speaker-bubble" aria-label="Current speaker message" hidden><header class="speaker-card-header"><small>CURRENT MESSAGE</small><button id="speaker-collapse" type="button" aria-label="Minimize current message" title="Minimize current message">−</button></header><div id="speaker-message"></div></aside></div><aside id="delegate-detail"></aside><section id="group-conversation" hidden><header><h2>The city safety discussion</h2><p id="discussion-description">A scenario briefing · electricity, water and public safety</p><div class="discussion-modes" aria-label="Discussion source"><button data-discussion-mode="civic" aria-pressed="true">City discussion</button><button data-discussion-mode="protocol" aria-pressed="false">Protocol log</button></div><div id="civic-advisory" role="status"></div><label class="topic-filter">Topic <select id="topic-filter"><option value="all">All topics</option><option>Electricity</option><option>Water</option><option>Public safety</option><option>Resolution</option></select></label><label>Show <select id="chat-filter"><option value="all">All representatives</option>${config.profiles.agents.map((p) => `<option value="${p.id}">${escape(p.label)} AI</option>`).join("")}</select></label><button id="show-all-messages">Read full discussion</button></header><div id="chat-messages" role="log" aria-label="Agent group conversation"></div></section><section id="collective-result" hidden></section><section id="room-evidence" hidden><div id="decision-guide"></div><details id="technical-evidence"><summary>Advanced controls & detailed evidence <span>Optional · full schedule, forecasts, metrics and disruptions</span></summary><div id="technical-panel"></div></details></section><section id="city-impact-view" hidden><div class="impact-guide"><small>DISASTER CITY · LIVE CONSEQUENCES</small><h2 id="street-condition">Waiting for a decision</h2><div class="street-view-controls"><button id="impact-street-view">People close-up</button><button id="impact-transit-view">Trains</button><button id="impact-city-view">Whole city</button></div><label>Trace electricity to <select id="signal-focus"><option value="all">All facilities</option>${config.profiles.agents.map((p) => `<option value="${p.id}">${escape(p.label)}</option>`).join("")}</select></label><label class="signal-toggle"><input id="signal-visible" type="checkbox" checked> Show electricity routes</label><details id="impact-key"><summary>Understand the map & signals</summary><div id="impact-safety-notice"></div><p>Street movement and rain illustrate recorded supply and service disruption. They are not measured panic, evacuation routes or a weather forecast.</p><p>Arrows show <b>electricity</b>: power station → district → facility. Routes float above the skyline as a diagram, not physical cables. Each label shows supplied / available power (PU).</p><div class="signal-key"><span><i style="background:#007dca"></i>Power flowing</span><span><i style="background:#d67700"></i>Line ≥90% full</span><span><i style="background:#dc3545"></i>Line unavailable</span><span><i style="background:#64748b"></i>No flow</span></div><p>Facility brightness shows service availability. Read agent negotiations in Group conversation.</p><p id="signal-readout" class="signal-readout">Choose a facility to follow its electricity supply.</p></details><p id="street-response">Approve a plan, then advance the simulation to see its effect.</p><small id="impact-comparison-note" hidden>Street activity follows the council result in both views. Line labels and facility colours compare each strategy.</small></div><div id="street-warnings" aria-live="polite" aria-label="Illustrative area warnings" hidden></div></section></div><footer class="chamber-footer"><div class="decision-controls"><button id="room-step">Next decision →</button><button id="room-run">Run simulation</button><label>Simulation <select id="room-sim-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label></div><div class="replay-controls"><span class="replay-indicator" id="replay-indicator" aria-hidden="true"></span><span id="replay-status">Discussion loading</span><span class="replay-progress"><i id="replay-progress-fill"></i></span><button id="replay-toggle">▶ Replay discussion</button><button id="replay-next" aria-label="Next message">Next message</button><button id="replay-all">Read all</button><label>Discussion <select id="room-chat-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label><span id="message-position">No decision yet</span></div></footer><div id="room-error" role="alert" hidden></div>`;
  document.querySelector("#app")!.append(root);
  const el = (id: string) => root.querySelector<HTMLElement>("#" + id)!;
  const oldPanel = document.querySelector<HTMLElement>("#council")!;
  el("technical-panel").append(oldPanel);
  oldPanel.classList.add("full-council-panel");
  let room: ReturnType<typeof createCouncilRoom> | undefined,
    tab = "room",
    selected: AgentId = "hospital",
    entries: CouncilTurn[] = civicDiscussion(store.tick, config),
    discussionMode: "civic" | "protocol" = "civic",
    cursor = 0,
    replaying = true,
    speakerExpanded = true,
    chatSpeed = 1,
    simSpeed = 1,
    lastAdvance = 0,
    lastTick: Tick | null = null,
    frame = 0,
    previousFocus: HTMLElement | null = null;
  const profiles = config.profiles.agents;
  function name(id: string) {
    return profiles.find((p) => p.id === id)?.label ?? id;
  }
  const labels = new Map<string, HTMLButtonElement>();
  for (const p of profiles) {
    const label = document.createElement("button");
    label.className = "delegate-label";
    label.textContent = `${p.label} AI`;
    label.dataset.delegate = p.id;
    label.onclick = () => {
      selected = p.id;
      renderDetails();
    };
    el("seat-labels").append(label);
    labels.set(p.id, label);
  }
  function setTab(next: string) {
    tab = next;
    root.dataset.view = next;
    lifecycle.impact(next === "impact");
    el("city-impact-view").hidden = next !== "impact";
    for (const b of root.querySelectorAll<HTMLElement>("[data-room-tab]")) {
      b.classList.toggle("active", b.dataset.roomTab === tab);
      b.setAttribute("aria-pressed", String(b.dataset.roomTab === tab));
    }
    el("room-stage").hidden = tab !== "room";
    el("delegate-detail").hidden = tab !== "room";
    el("group-conversation").hidden = tab !== "chat";
    el("collective-result").hidden = tab !== "results";
    el("room-evidence").hidden = tab !== "evidence";
    el("action-review").hidden =
      store.state !== "AwaitingHuman" || tab === "evidence";
    renderDiscussion();
  }
  function renderDetails() {
    const a = store.tick?.agents.find((a) => a.id === selected),
      p = profiles.find((p) => p.id === selected)!;
    const latest = entries
      .slice(0, cursor + 1)
      .filter((e) => e.speaker === selected)
      .at(-1);
    el("delegate-detail").innerHTML =
      `<small>YOUR SELECTED REPRESENTATIVE</small><div class="delegate-avatar">${escape(p.label.slice(0, 2).toUpperCase())}</div><h2>${escape(p.label)} AI</h2><p>Tier ${p.tier} utility representative</p><label class="delegate-select">Choose a seat<select id="delegate-select">${profiles.map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${escape(p.label)} AI</option>`).join("")}</select></label><div class="delegate-statement"><small>AT THIS POINT IN THE DISCUSSION</small>${latest ? `<div class="discussion-badges">${badges(latest)}</div>` : ""}<p>${latest ? escape(latest.text) : "No message from this representative has been revealed yet."}</p></div><h3>Committed city state</h3><p class="detail-note">These values are the completed decision, not the offer currently being replayed.</p><dl><dt>Requested power</dt><dd>${a ? a.demand.toFixed(2) : "—"} PU</dd><dt>Allocated power</dt><dd>${a ? a.allocated.toFixed(2) : "—"} PU</dd><dt>Backup remaining</dt><dd>${a ? a.reserveHours.toFixed(2) : "—"} h</dd><dt>Effective service</dt><dd>${a ? (a.service * 100).toFixed(0) + "% · " + a.status : "Awaiting decision"}</dd></dl><p>${p.dependsOn.length ? "Depends on " + p.dependsOn.map((d) => escape(name(d.agent))).join(", ") + "." : "No upstream service dependencies in this model."}</p><button id="delegate-chat">Read ${escape(p.label)} messages →</button>`;
    el("delegate-select").onchange = (e) => {
      selected = (e.target as HTMLSelectElement).value as AgentId;
      renderDetails();
    };
    el("delegate-chat").onclick = () => {
      (el("chat-filter") as HTMLSelectElement).value = selected;
      setTab("chat");
    };
    labels.forEach((l, id) => l.classList.toggle("selected", id === selected));
  }
  const sentimentLabels = {
    proposal: "Proposal",
    concern: "Concern",
    challenge: "Disagreement",
    agreement: "Support",
    urgent: "Urgent",
    information: "Context",
  };
  function badges(entry: CouncilTurn) {
    return `<span class="discussion-topic">${escape(entry.topic)}</span><span class="sentiment-badge sentiment-${entry.sentiment}">${sentimentLabels[entry.sentiment]}</span>${entry.unavailable ? '<span class="sentiment-badge">Seat unavailable · prepared brief</span>' : ""}`;
  }
  function renderDiscussion() {
    const current = entries[cursor];
    const advisory = civicAdvisory(store.tick, config);
    for (const id of ["civic-advisory", "impact-safety-notice"]) {
      const notice = el(id);
      notice.className = `civic-advisory advisory-${advisory.level}`;
      notice.innerHTML = `<details ${advisory.level === "red" ? "open" : ""}><summary>${escape(advisory.title)}</summary><p>${escape(advisory.text)}</p><small>Scenario proposal · not a real public warning</small></details>`;
    }
    el("civic-advisory").hidden = discussionMode === "protocol";
    el("topic-filter").parentElement!.hidden = discussionMode === "protocol";
    el("discussion-description").textContent =
      discussionMode === "civic"
        ? "Scenario discussion · proposed city actions, informed by service data."
        : "Recorded electricity protocol · actual messages in engine order, including delivery losses.";
    el("message-position").textContent = entries.length
      ? `${Math.max(0, cursor + 1)} / ${entries.length} · ${discussionMode === "civic" ? "city discussion" : "protocol records"}`
      : "No protocol records yet";
    el("replay-status").textContent = !entries.length
      ? "Waiting for a completed decision"
      : replaying
        ? `${name(current?.speaker ?? "")} AI is speaking · ${cursor + 1} of ${entries.length}`
        : cursor >= entries.length - 1
          ? `Discussion complete · ${entries.length} messages`
          : `Discussion paused · ${cursor + 1} of ${entries.length}`;
    el("replay-indicator").classList.toggle(
      "is-live",
      replaying && entries.length > 0,
    );
    el("replay-progress-fill").style.width =
      `${entries.length ? Math.max(0, ((cursor + 1) / entries.length) * 100) : 0}%`;
    el("replay-toggle").textContent = replaying
      ? "Ⅱ Pause discussion"
      : "▶ Replay discussion";
    el("speaker-bubble").hidden = !speakerExpanded;
    el("speaker-toggle").setAttribute("aria-expanded", String(speakerExpanded));
    const toggleLabel = speakerExpanded
      ? "Hide current message"
      : "Show current message";
    el("speaker-toggle").setAttribute("aria-label", toggleLabel);
    el("speaker-toggle").title = toggleLabel;
    if (current) {
      el("speaker-bubble").className = `sentiment-${current.sentiment}`;
      el("speaker-message").innerHTML =
        `<div class="discussion-badges">${badges(current)}</div><b>${escape(name(current.speaker))} AI</b><h3>${escape(current.title)}</h3><p>${escape(current.text)}</p><small>${discussionMode === "civic" ? "Scenario deliberation" : escape(current.evidence.join(" · "))}</small>`;
    } else {
      el("speaker-message").textContent =
        "No message yet. Start or advance the discussion to hear from the representatives.";
    }
    if (tab === "chat") {
      const filter = (el("chat-filter") as HTMLSelectElement).value;
      const topic = (el("topic-filter") as HTMLSelectElement).value;
      const shown = entries
        .slice(0, cursor + 1)
        .filter(
          (e) =>
            (filter === "all" || e.speaker === filter) &&
            (discussionMode === "protocol" ||
              topic === "all" ||
              e.topic === topic),
        );
      el("chat-messages").innerHTML = shown.length
        ? shown
            .map((e) => {
              const parent = entries.find((p) => p.id === e.replyTo);
              return `<article id="turn-${e.id}" class="chat-message sentiment-${e.sentiment}" data-topic="${escape(e.topic)}"><div class="chat-avatar">${escape(name(e.speaker).slice(0, 2).toUpperCase())}</div><div><header><b>${escape(name(e.speaker))} AI</b><div class="discussion-badges">${badges(e)}</div></header>${parent ? `<button class="discussion-reply" data-reply="${parent.id}">↳ In reply to ${escape(name(parent.speaker))}: ${escape(parent.title)}</button>` : ""}<h3>${escape(e.title)}</h3><p>${escape(e.text)}</p><details class="discussion-evidence"><summary>${discussionMode === "civic" ? "Basis for this briefing" : "Delivery details"}</summary>${e.evidence.map((f) => `<p>${escape(f)}</p>`).join("")}</details></div></article>`;
            })
            .join("")
        : '<div class="chat-empty">No messages in this view yet. Choose Read full discussion or another topic. Protocol records appear after a completed decision.</div>';
      el("chat-messages")
        .querySelectorAll<HTMLButtonElement>("[data-reply]")
        .forEach(
          (button) =>
            (button.onclick = () => {
              (el("chat-filter") as HTMLSelectElement).value = "all";
              (el("topic-filter") as HTMLSelectElement).value = "all";
              renderDiscussion();
              el(`turn-${button.dataset.reply}`).scrollIntoView({
                block: "center",
                behavior: "smooth",
              });
            }),
        );
    }
    renderDetails();
  }
  function renderResults() {
    el("collective-result").innerHTML = resultDashboard(store.tick, config, [
      ...(store.history.get(store.branch)?.values() ?? []),
    ]);
  }
  function render() {
    if (store.tick !== lastTick) {
      lastTick = store.tick;
      entries =
        discussionMode === "civic"
          ? civicDiscussion(lastTick, config)
          : protocolDiscussion(lastTick);
      cursor = entries.length ? 0 : -1;
      replaying = entries.length > 0;
      lastAdvance = performance.now();
      renderResults();
    }
    el("conversation-count").textContent = String(entries.length);
    el("chamber-state").textContent =
      `${store.tick ? `${String(Math.floor(store.tick.hour)).padStart(2, "0")}:${String((store.tick.t % 6) * 10).padStart(2, "0")}` : "00:00"} · ${store.state === "AwaitingHuman" ? "Your approval is needed" : store.state} · Branch ${store.branch}`;
    el("room-run").textContent = store.running
      ? "Pause simulation"
      : store.state === "AwaitingHuman"
        ? "Approve first"
        : store.state === "Executing"
          ? "Run continuously"
          : "Preparing plan";
    const awaiting = store.state === "AwaitingHuman" && !!store.plan;
    el("global-approve").hidden = !awaiting;
    if (awaiting && store.error)
      (el("global-approve") as HTMLButtonElement).disabled = false;
    el("action-review").hidden = !awaiting || tab === "evidence";
    const approved = !!store.plan && store.state === "Executing";
    el("action-number").textContent = awaiting
      ? "02"
      : approved || store.tick
        ? "03"
        : "01";
    el("action-title").textContent = awaiting
      ? "Your approval is needed"
      : store.running
        ? "Simulation is running"
        : approved
          ? "Plan approved · advance the city"
          : store.tick
            ? "Decision committed"
            : "Preparing the first plan";
    el("action-detail").textContent = awaiting
      ? `Review plan ${store.plan!.id}, then approve it here from any view.`
      : store.running
        ? `The city is advancing automatically${store.tick ? ` · last completed tick ${store.tick.t}` : ""}. Pause to step manually.`
        : approved
          ? `Advance ten minutes to apply the next decision${store.tick ? `, or inspect tick ${store.tick.t}` : ""}.`
          : store.tick
            ? `Tick ${store.tick.t} is applied. A new plan is being prepared.`
            : "The council is preparing and testing an electricity schedule.";
    el("room-step").textContent = awaiting
      ? "Review & approve →"
      : store.running
        ? "Running…"
        : approved
          ? "Advance 10 min →"
          : "Preparing plan…";
    (el("room-step") as HTMLButtonElement).disabled =
      !awaiting && (!approved || store.running);
    (el("room-run") as HTMLButtonElement).disabled = !approved;
    el("room-error").hidden = !store.error;
    el("room-error").textContent = store.error;
    renderGuide();
    renderDiscussion();
  }
  let guideKey = "";
  function renderGuide() {
    const key = JSON.stringify([
      store.plan?.id,
      store.presim?.planId,
      store.state,
      Math.floor(store.progress * 10),
    ]);
    if (key === guideKey) return;
    guideKey = key;
    const note =
      (root.querySelector("#guide-note") as HTMLTextAreaElement | null)
        ?.value ?? "";
    el("decision-guide").innerHTML = decisionGuide(store, config);
    const textarea = root.querySelector<HTMLTextAreaElement>("#guide-note");
    if (textarea) textarea.value = note;
    const approve = root.querySelector<HTMLButtonElement>("#guide-approve");
    if (approve)
      approve.onclick = () => {
        if (store.plan)
          send({
            type: "APPROVE",
            planId: store.plan.id,
            hash: store.plan.hash,
          });
      };
    const reject = root.querySelector<HTMLButtonElement>("#guide-reject");
    if (reject)
      reject.onclick = () => {
        if (store.plan)
          send({
            type: "REJECT",
            planId: store.plan.id,
            note:
              textarea?.value.trim() || "Please reconsider service protection.",
          });
      };
    const watch = root.querySelector<HTMLButtonElement>("#guide-watch");
    if (watch) watch.onclick = () => setTab("room");
  }
  function animate(now: number) {
    if (root.hidden) return;
    if (
      replaying &&
      now - lastAdvance >
        Math.min(
          6000,
          Math.max(2800, readingTime(entries[cursor]?.text ?? "") / 4),
        ) /
          chatSpeed
    ) {
      lastAdvance = now;
      if (cursor < entries.length - 1) {
        cursor++;
        renderDiscussion();
      } else {
        replaying = false;
        renderDiscussion();
      }
    }
    if (tab === "room" && room) {
      room.render(
        now / 1000,
        replaying && !entries[cursor]?.unavailable
          ? entries[cursor]?.speaker
          : undefined,
        selected,
      );
      const r = el("room-stage").getBoundingClientRect();
      for (const seat of room.seats) {
        const p = seat.anchor.clone().project(room.camera),
          label = labels.get(seat.id)!;
        label.style.left = `${(p.x * 0.5 + 0.5) * r.width}px`;
        label.style.top = `${(-p.y * 0.5 + 0.5) * r.height}px`;
        label.hidden = p.z > 1;
        label.classList.toggle(
          "speaking",
          replaying &&
            !entries[cursor]?.unavailable &&
            seat.id === entries[cursor]?.speaker,
        );
      }
    }
    frame = requestAnimationFrame(animate);
  }
  const inertSiblings = new Map<HTMLElement, boolean>();
  function open() {
    if (!root.hidden) return;
    previousFocus = document.activeElement as HTMLElement;
    root.hidden = false;
    for (const child of root.parentElement!.children) {
      if (child instanceof HTMLElement && child !== root) {
        inertSiblings.set(child, child.inert);
        child.inert = true;
      }
    }
    document.body.classList.add("in-council");
    speakerExpanded = window.innerWidth > 700;
    lifecycle.enter();
    lifecycle.impact(tab === "impact");
    try {
      room ??= createCouncilRoom(
        el("conference-canvas") as HTMLCanvasElement,
        profiles,
        (id) => {
          selected = id;
          renderDetails();
        },
      );
    } catch (e) {
      store.error = `Council room unavailable: ${String(e)}`;
      setTab("chat");
    }
    renderResults();
    render();
    frame = requestAnimationFrame(animate);
    el("leave-council").focus();
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true;
    speakerExpanded = false;
    replaying = false;
    lifecycle.impact(false);
    lifecycle.exit();
    inertSiblings.forEach((wasInert, element) => {
      element.inert = wasInert;
    });
    inertSiblings.clear();
    document.body.classList.remove("in-council");
    cancelAnimationFrame(frame);
    previousFocus?.focus();
  }
  const openEvent = () => open();
  document.addEventListener("open-council", openEvent);
  launcher.onclick = open;
  el("leave-council").onclick = close;
  function collapseSpeaker() {
    speakerExpanded = false;
    renderDiscussion();
    el("speaker-toggle").focus();
  }
  el("speaker-toggle").onclick = () => {
    speakerExpanded = !speakerExpanded;
    renderDiscussion();
  };
  el("speaker-collapse").onclick = collapseSpeaker;
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      if (speakerExpanded && tab === "room") collapseSpeaker();
      else close();
    }
  });
  root
    .querySelectorAll<HTMLElement>("[data-room-tab]")
    .forEach((b) => (b.onclick = () => setTab(b.dataset.roomTab!)));
  el("room-help").onclick = () => {
    el("chamber-help").hidden = !el("chamber-help").hidden;
    el("room-help").setAttribute(
      "aria-expanded",
      String(!el("chamber-help").hidden),
    );
  };
  el("room-top").onclick = () => room?.top();
  el("room-overview").onclick = () => room?.overview();
  el("replay-toggle").onclick = () => {
    if (!entries.length) return;
    if (cursor >= entries.length - 1) cursor = -1;
    replaying = !replaying;
    lastAdvance = 0;
    renderDiscussion();
  };
  el("replay-next").onclick = () => {
    replaying = false;
    cursor = Math.min(cursor + 1, entries.length - 1);
    renderDiscussion();
  };
  el("show-all-messages").onclick = () => {
    cursor = entries.length - 1;
    replaying = false;
    renderDiscussion();
  };
  el("replay-all").onclick = () => {
    cursor = entries.length - 1;
    replaying = false;
    setTab("chat");
  };
  el("action-review").onclick = () => setTab("evidence");
  el("global-approve").onclick = () => {
    if (store.state === "AwaitingHuman" && store.plan) {
      send({ type: "APPROVE", planId: store.plan.id, hash: store.plan.hash });
      (el("global-approve") as HTMLButtonElement).disabled = true;
      el("action-detail").textContent =
        "Approval sent. Waiting for the council to continue…";
    }
  };
  for (const id of ["chat-filter", "topic-filter"])
    el(id).onchange = () => {
      cursor = entries.length - 1;
      replaying = false;
      renderDiscussion();
    };
  root.querySelectorAll<HTMLButtonElement>("[data-discussion-mode]").forEach(
    (button) =>
      (button.onclick = () => {
        discussionMode = button.dataset.discussionMode as "civic" | "protocol";
        entries =
          discussionMode === "civic"
            ? civicDiscussion(store.tick, config)
            : protocolDiscussion(store.tick);
        cursor = entries.length - 1;
        replaying = false;
        (el("chat-filter") as HTMLSelectElement).value = "all";
        (el("topic-filter") as HTMLSelectElement).value = "all";
        root
          .querySelectorAll("[data-discussion-mode]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        el("conversation-count").textContent = String(entries.length);
        renderDiscussion();
      }),
  );
  el("room-chat-speed").onchange = (e) => {
    chatSpeed = Number((e.target as HTMLSelectElement).value);
  };
  el("room-sim-speed").onchange = (e) => {
    simSpeed = Number((e.target as HTMLSelectElement).value);
    if (store.running) send({ type: "RUN", speed: simSpeed });
  };
  function advance(run: boolean) {
    if (store.state === "AwaitingHuman" || !store.plan) {
      setTab("evidence");
      if (!store.plan && store.state === "Idle")
        send({ type: "REQUEST_PLAN", horizonTicks: 18 });
      return;
    }
    send(run ? { type: "RUN", speed: simSpeed } : { type: "STEP" });
  }
  el("room-step").onclick = () => advance(false);
  el("room-run").onclick = () =>
    store.running ? send({ type: "PAUSE" }) : advance(true);
  render();
  return {
    open,
    render,
    isOpen: () => !root.hidden,
    dispose() {
      close();
      document.removeEventListener("open-council", openEvent);
      room?.dispose();
      root.remove();
      launcher.remove();
    },
  };
}
