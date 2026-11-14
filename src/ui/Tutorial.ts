import "./tutorial.css";

type Tour = "city" | "council" | "reality" | "facilities";
type Step = {
  target: string;
  title: string;
  body: string;
  prepare?: () => void;
  wait?: number;
};
type Facility = { id: string; name: string; description: string };
type Options = {
  facilities: Facility[];
  focusFacility: (id: string) => void;
  clearFacility: () => void;
};
const key = (mode: Tour) => `vp:tutorial:${mode}:v1`;
const done = (mode: Tour) => {
  try {
    return localStorage.getItem(key(mode)) === "done";
  } catch {
    return false;
  }
};
const save = (mode: Tour) => {
  try {
    localStorage.setItem(key(mode), "done");
  } catch {
    /* private storage */
  }
};
const $ = (selector: string) => document.querySelector<HTMLElement>(selector);

export function mountTutorial(options: Options) {
  const launcher = document.createElement("button");
  launcher.id = "tutorial-launcher";
  launcher.type = "button";
  launcher.innerHTML = `<span aria-hidden="true">✦</span><b>Guide</b>`;
  launcher.setAttribute("aria-label", "Restart guided tutorial");
  document.body.append(launcher);
  const layer = document.createElement("div");
  layer.id = "tutorial-layer";
  layer.hidden = true;
  layer.innerHTML = `<div class="tutorial-shade"></div><div class="tutorial-focus"></div><svg class="tutorial-arrow" aria-hidden="true"><defs><marker id="tutorial-arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e5bc72"/></marker></defs><path id="tutorial-arrow-path" marker-end="url(#tutorial-arrowhead)"/></svg><section class="tutorial-card" role="dialog" aria-modal="false" aria-label="Guided tutorial"><div class="tutorial-top"><span id="tutorial-mode"></span><span id="tutorial-count"></span><button id="tutorial-exit" type="button" aria-label="Exit tutorial" title="Exit tutorial">×</button></div><div class="tutorial-meter"><i id="tutorial-meter-fill"></i></div><h2 id="tutorial-title"></h2><p id="tutorial-body"></p><div id="tutorial-confirm" hidden><b>You are new to the system. Are you sure you want to skip the tutorial?</b><div><button id="tutorial-stay">Keep the tour</button><button id="tutorial-skip-confirm">Yes, skip</button></div></div><div class="tutorial-actions"><button id="tutorial-back">← Back</button><button id="tutorial-skip">Skip tutorial</button><button id="tutorial-next">Next →</button></div></section>`;
  document.body.append(layer);
  const focus = layer.querySelector<HTMLElement>(".tutorial-focus")!;
  const arrow = layer.querySelector<SVGPathElement>("#tutorial-arrow-path")!;
  const svg = layer.querySelector<SVGSVGElement>(".tutorial-arrow")!;
  const card = layer.querySelector<HTMLElement>(".tutorial-card")!;
  const inLayer = (id: string) => layer.querySelector<HTMLElement>(`#${id}`)!;
  const roomTab = (tab: string) => $(`[data-room-tab="${tab}"]`)?.click();
  const city: Step[] = [
    {
      target: ".brand",
      title: "Welcome to Nagar",
      body: "Explore the 3D city, inspect its services, then enter Panchayat Square to make a disaster decision. Use Next at your pace; the Guide button reopens this tour later.",
    },
    {
      target: "#panchayat-pin",
      title: "Your destination: Panchayat Square",
      body: "This compact pin marks the council entry. Select it to focus the square, then choose Enter disaster council.",
    },
    {
      target: "#directory-toggle",
      title: "Explore places and services",
      body: "Explore opens the city directory. Places fly to districts; City services lists the hospital, waterworks, communications, shelter and other facilities.",
    },
    {
      target: "#labels",
      title: "Landmarks and facility tour",
      body: "Landmark pins start on. Toggle them here; Tour all facilities visits every modelled service one by one with a camera close-up.",
    },
    {
      target: ".view-tools",
      title: "Move around the city",
      body: "Use plus and minus to zoom, rotate for an orbit, and the map icon to reset. Drag the scene to orbit and use the minimap to jump across Nagar.",
    },
    {
      target: ".activity-dock",
      title: "Control the city illustration",
      body: "Pause the moving city or change its speed here. These controls affect the ambient scene, not the council decision clock.",
    },
    {
      target: "#weather-toggle",
      title: "Weather and daylight",
      body: "Switch the visual weather here and cycle daylight with the adjacent sun button. Sunny daylight is the starting view; historical weather forecasts live in Real System.",
    },
    {
      target: "#reality-entry",
      title: "Explore the real system",
      body: "Inspect source datasets, trained forecasts, historical replay, decision logic and limitations on this evidence page.",
    },
    {
      target: "#enter-council",
      title: "Enter disaster council",
      body: "Open the chamber to choose an emergency, review the proposed power plan, approve it, and inspect the result. A shorter chamber guide opens there on first visit.",
    },
  ];
  const council: Step[] = [
    {
      target: "#case-select",
      title: "Choose an emergency",
      body: "Pick a cyclone, flood, heatwave, distribution fault or historical replay. Restart case loads fresh events and a fresh simulation; historical replay uses trained forecasts and measured national load.",
      prepare: () => roomTab("room"),
    },
    {
      target: "#conference-canvas",
      title: "Meet the council",
      body: "Ten utility representatives discuss the case. Select a seat to inspect its request, service and allocation; the detail panel appears only after a selection.",
      prepare: () => roomTab("room"),
    },
    {
      target: "#replay-toggle",
      title: "Follow the conversation",
      body: "Replay, Next message and Read all control how quickly the discussion appears. Discussion speed changes playback only; it does not advance simulated time.",
      prepare: () => roomTab("room"),
    },
    {
      target: '[data-room-tab="chat"]',
      title: "Read both discussion views",
      body: "Group conversation contains the case briefing and actual electricity protocol. Filters focus topics or representatives; the protocol records delivered and lost messages.",
    },
    {
      target: '[data-room-tab="evidence"]',
      title: "Review Your Decision",
      body: "Compare requested and proposed power, the three-hour outlook, water and telecom allocations, constraints and safeguards before deciding.",
    },
    {
      target: "#global-approve",
      title: "Approve or request a revision",
      body: "Approve applies to the exact reviewed proposal. On Your Decision you can also reject it with a reason and request a new plan.",
      prepare: () => roomTab("evidence"),
    },
    {
      target: "#room-step",
      title: "Advance the disaster clock",
      body: "After approval, Next decision applies ten simulated minutes. Run simulation advances automatically; its speed is separate from discussion playback.",
    },
    {
      target: '[data-room-tab="results"]',
      title: "Inspect the Collective Result",
      body: "See applied power, safety checks, water and telecom detail, all ten allocations, network constraints and a branded decision PDF after a completed tick.",
    },
    {
      target: '[data-room-tab="impact"]',
      title: "See city impact",
      body: "Explore the illustrated service response and electricity routes. Street movement and public safety actions are modelled, not measured operations.",
    },
    {
      target: "#leave-council",
      title: "Return or replay this guide",
      body: "Leave disaster mode here. How it works opens concise instructions, and Chamber guide on the side restarts this walkthrough anytime.",
    },
  ];
  const reality: Step[] = [
    {
      target: "#rv-back",
      title: "The Real System",
      body: "This page separates measured datasets, trained forecasts, authored simulation inputs and limitations.",
    },
    {
      target: "#rv-tab-0",
      title: "Electricity",
      body: "Inspect the ten anonymous meters and saved demand forecast. These meters are mapped to simulated utility roles.",
    },
    {
      target: "#rv-tab-1",
      title: "Weather",
      body: "See the historical weather replay and the model or baseline selected for each target.",
    },
    {
      target: "#rv-tab-2",
      title: "Council",
      body: "Follow how the constrained decision engine converts forecasts into an approved plan.",
    },
    {
      target: "#rv-tab-3",
      title: "Telemetry",
      body: "Inspect measured Portugal national load. It is shown as context, not local feeder capacity.",
    },
    {
      target: "#rv-play",
      title: "Play the historical replay",
      body: "Play or pause the three-hour data walkthrough.",
      prepare: () => $("#rv-lab")?.scrollIntoView({ block: "center" }),
    },
    {
      target: "#rv-timeline",
      title: "Choose a replay time",
      body: "Drag to inspect each ten-minute interval and its corresponding data.",
      prepare: () => $("#rv-lab")?.scrollIntoView({ block: "center" }),
    },
    {
      target: "#rv-agent-list [data-agent]",
      title: "Inspect an agent",
      body: "Choose a utility to see its code-backed profile and the selected replay’s forecast demand.",
      prepare: () => $(".rv-agents")?.scrollIntoView({ block: "start" }),
    },
    {
      target: ".rv-sources",
      title: "Trace the sources",
      body: "Find dataset links, checksums and the authored inputs used by the demonstration.",
      prepare: () => $(".rv-sources")?.scrollIntoView({ block: "start" }),
    },
    {
      target: ".rv-precision",
      title: "Understand the limits",
      body: "Read exactly what the system can and cannot claim before using it for decisions.",
      prepare: () => $(".rv-precision")?.scrollIntoView({ block: "center" }),
    },
  ];
  const facilities: Step[] = options.facilities.map((item) => ({
    target: `.landmark[data-facility="${item.id}"]`,
    title: item.name,
    body: `${item.description} This facility is a modelled city role. Select its pin later to inspect it again.`,
    prepare: () => options.focusFacility(item.id),
    wait: 700,
  }));
  facilities.push({
    target: "#panchayat-pin",
    title: "Finish at Panchayat Square",
    body: "This is the main council entry point. Select the pin, then Enter disaster council to review the emergency plan.",
    prepare: options.clearFacility,
    wait: 200,
  });
  const steps: Record<Tour, Step[]> = { city, council, reality, facilities };
  let active: Tour | null = null,
    index = 0,
    stamp = 0,
    frame = 0,
    positioned = false,
    target: HTMLElement | null = null;
  const currentMode = (): Tour =>
    document.body.classList.contains("in-council")
      ? "council"
      : document.body.classList.contains("reality-open")
        ? "reality"
        : "city";
  const updateLauncher = () => {
    launcher.innerHTML = `<span aria-hidden="true">✦</span><b>${currentMode() === "council" ? "Chamber guide" : currentMode() === "reality" ? "Page guide" : "Guide"}</b>`;
  };
  function place() {
    if (!active || !target || layer.hidden) return;
    const r = target.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const pad = 7;
    Object.assign(focus.style, {
      left: `${r.left - pad}px`,
      top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
    const w = card.offsetWidth,
      h = card.offsetHeight,
      mobile = innerWidth < 700;
    let x: number, y: number;
    if (mobile) {
      x = 12;
      y = r.top > innerHeight * 0.52 ? 12 : innerHeight - h - 12;
    } else {
      x = r.right + w + 28 < innerWidth ? r.right + 22 : r.left - w - 22;
      x = Math.max(16, Math.min(x, innerWidth - w - 16));
      y = Math.max(16, Math.min(r.top, innerHeight - h - 16));
    }
    if (!positioned) {
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      positioned = true;
    } else {
      x = card.offsetLeft;
      y = card.offsetTop;
    }
    svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    const cx = r.left + r.width / 2,
      cy = r.top + r.height / 2;
    const sx = cx > x + w / 2 ? x + w : x,
      sy = Math.max(y + 18, Math.min(cy, y + h - 18));
    const midX = (sx + cx) / 2;
    arrow.setAttribute("d", `M ${sx} ${sy} Q ${midX} ${sy} ${cx} ${cy}`);
  }
  function loop() {
    place();
    frame = requestAnimationFrame(loop);
  }
  function hide() {
    stamp++;
    cancelAnimationFrame(frame);
    layer.hidden = true;
    target = null;
    active = null;
    launcher.hidden = false;
    updateLauncher();
  }
  function finish() {
    if (active) save(active);
    const wasFacilities = active === "facilities";
    hide();
    if (wasFacilities) options.clearFacility();
  }
  async function show() {
    if (!active) return;
    const token = ++stamp,
      step = steps[active][index];
    (inLayer("tutorial-next") as HTMLButtonElement).disabled = true;
    (inLayer("tutorial-back") as HTMLButtonElement).disabled = true;
    inLayer("tutorial-confirm").hidden = true;
    step.prepare?.();
    await new Promise((resolve) => setTimeout(resolve, step.wait ?? 100));
    if (!active || token !== stamp) return;
    target = $(step.target);
    if (active === "facilities" && (!target || target.hidden))
      target = $("#selection");
    if (
      !target ||
      target.hidden ||
      target.getBoundingClientRect().width === 0
    ) {
      if (index < steps[active].length - 1) {
        index++;
        void show();
      } else finish();
      return;
    }
    if (active === "reality")
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    positioned = false;
    inLayer("tutorial-mode").textContent =
      active === "facilities"
        ? "FACILITY TOUR"
        : active === "council"
          ? "DISASTER COUNCIL GUIDE"
          : active === "reality"
            ? "REAL SYSTEM GUIDE"
            : "CITY GUIDE";
    inLayer("tutorial-count").textContent =
      `${index + 1} / ${steps[active].length}`;
    inLayer("tutorial-title").textContent = step.title;
    inLayer("tutorial-body").textContent = step.body;
    inLayer("tutorial-meter-fill").style.width =
      `${((index + 1) / steps[active].length) * 100}%`;
    (inLayer("tutorial-back") as HTMLButtonElement).disabled = index === 0;
    (inLayer("tutorial-next") as HTMLButtonElement).disabled = false;
    inLayer("tutorial-next").textContent =
      index === steps[active].length - 1 ? "Finish ✓" : "Next →";
    place();
  }
  function start(mode: Tour, automatic = false) {
    if (automatic && done(mode)) return;
    if (active) hide();
    if (
      mode === "facilities" &&
      $("#labels")?.getAttribute("aria-pressed") === "false"
    )
      $("#labels")?.click();
    active = mode;
    index = 0;
    layer.hidden = false;
    launcher.hidden = true;
    frame = requestAnimationFrame(loop);
    void show();
  }
  inLayer("tutorial-next").onclick = () => {
    if (!active) return;
    if (index === steps[active].length - 1) finish();
    else {
      index++;
      void show();
    }
  };
  inLayer("tutorial-back").onclick = () => {
    if (active && index > 0) {
      index--;
      void show();
    }
  };
  inLayer("tutorial-skip").onclick = () => {
    inLayer("tutorial-confirm").hidden = false;
    positioned = false;
    requestAnimationFrame(place);
  };
  inLayer("tutorial-exit").onclick = () => {
    inLayer("tutorial-confirm").hidden = false;
    positioned = false;
    requestAnimationFrame(place);
  };
  inLayer("tutorial-stay").onclick = () => {
    inLayer("tutorial-confirm").hidden = true;
    positioned = false;
    requestAnimationFrame(place);
  };
  inLayer("tutorial-skip-confirm").onclick = finish;
  launcher.onclick = () => start(currentMode());
  $("#facility-tour")!.onclick = () => start("facilities");
  const onCouncil = () =>
    setTimeout(() => {
      updateLauncher();
      start("council", true);
    }, 150);
  const offCouncil = () => {
    if (active === "council") hide();
    updateLauncher();
  };
  const onReality = () =>
    setTimeout(() => {
      updateLauncher();
      start("reality", true);
    }, 150);
  const offReality = () => {
    if (active === "reality") hide();
    updateLauncher();
  };
  document.addEventListener("council-opened", onCouncil);
  document.addEventListener("close-council", offCouncil);
  document.addEventListener("open-reality", onReality);
  document.addEventListener("close-reality", offReality);
  const onKey = (event: KeyboardEvent) => {
    if (!active) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      inLayer("tutorial-confirm").hidden = false;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      inLayer("tutorial-next").click();
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      inLayer("tutorial-back").click();
    }
  };
  document.addEventListener("keydown", onKey, true);
  const waitForCity = () => {
    if (document.body.classList.contains("in-council")) return;
    if (document.body.classList.contains("reality-open")) {
      updateLauncher();
      start("reality", true);
      return;
    }
    if (!$("#loading")?.classList.contains("loaded")) {
      requestAnimationFrame(waitForCity);
      return;
    }
    updateLauncher();
    start("city", true);
  };
  requestAnimationFrame(waitForCity);
  return {
    start,
    dispose() {
      hide();
      launcher.remove();
      layer.remove();
      document.removeEventListener("council-opened", onCouncil);
      document.removeEventListener("close-council", offCouncil);
      document.removeEventListener("open-reality", onReality);
      document.removeEventListener("close-reality", offReality);
      document.removeEventListener("keydown", onKey, true);
    },
  };
}
