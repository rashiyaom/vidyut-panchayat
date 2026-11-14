import profiles from "../../data/agents/profiles.json";
import network from "../../data/network/electrical_v1.json";
import scenario from "../../data/scenarios/cyclone_24h.json";
import electricity from "../../experiments/ml/model_comparison.json";
import electricityData from "../../data/processed/electricity/manifest.json";
import weather from "../../experiments/ml/weather_model_evaluation.json";
import weatherData from "../../data/processed/weather/manifest.json";
import weatherReplay from "../../data/ml/weather_browser_replay_v1.json";
import grid from "../../data/processed/telemetry/pt_load_2014-09-15.json";
import replay from "../../data/ml/browser_replay_v1.json";
import audit from "../../experiments/ml/revision_audit_summary.json";
import { gridLoadAt } from "../contract/gridTelemetry";
import { weatherStress } from "../contract/weatherStress";
import "./realityPage.css";

const repo = "https://github.com/rashiyaom/vidyut-panchayat/blob/main/";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const n = (value: number, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const clock = (tick: number) => `${String(Math.floor(tick / 6)).padStart(2, "0")}:${String((tick % 6) * 10).padStart(2, "0")}`;
const weatherForecast = {
  originPortugal: weatherReplay.originPortugal,
  windSpeed: weatherReplay.weather.wind_speed_10m.rows.map((row) => row.forecast),
  precipitation: weatherReplay.weather.precipitation.rows.map((row) => row.forecast),
};
const gridTelemetry = { originPortugal: grid.originPortugal, originUtc: grid.originUtc, samples: grid.samples };
const stages = ["Electricity", "Weather", "The council", "Telemetry"] as const;
type Stage = typeof stages[number];

function towers() {
  return `<div class="rv-power-art" aria-hidden="true"><div class="rv-depth-grid"></div><svg viewBox="0 0 900 440" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="rv-wire" x1="0" x2="1"><stop stop-color="#f4bc63"/><stop offset=".5" stop-color="#fff3b5"/><stop offset="1" stop-color="#f4bc63"/></linearGradient></defs>
    <path class="rv-wire" id="rv-wire-path" d="M 290 184 Q 450 216 610 184" fill="none" stroke="url(#rv-wire)" stroke-width="4"/>
    <path class="rv-wire rv-wire-secondary" d="M 290 201 Q 450 234 610 201" fill="none" stroke="#bde9c4" stroke-width="2"/>
    <g class="rv-tower rv-tower-left" stroke="#d1e5ce" stroke-width="5" fill="none" stroke-linejoin="round"><path d="M176 378 242 98 308 378M242 98 242 378M199 274h86M210 224h64M222 170h40M184 339h116M214 184h-48m48 0h56m0 0h48M202 226h-50m50 0h80m0 0h50"/></g>
    <g class="rv-tower rv-tower-right" stroke="#d1e5ce" stroke-width="5" fill="none" stroke-linejoin="round"><path d="M592 378 658 98 724 378M658 98 658 378M615 274h86M626 224h64M638 170h40M600 339h116M630 184h-48m48 0h56m0 0h48M618 226h-50m50 0h80m0 0h50"/></g>
    <circle r="9" fill="#ffe28b" class="rv-spark"><animateMotion dur="2.4s" repeatCount="indefinite"><mpath href="#rv-wire-path"/></animateMotion></circle>
    <circle r="3" fill="#fff" class="rv-spark"><animateMotion dur="2.4s" repeatCount="indefinite"><mpath href="#rv-wire-path"/></animateMotion></circle>
  </svg><div class="rv-power-caption"><span>10 measured meters</span><span>3-hour forecast</span><span>10 synthetic feeders</span></div></div>`;
}
function weatherArt() {
  return `<div class="rv-weather-art" aria-hidden="true"><div class="rv-sun"></div><div class="rv-cloud rv-cloud-one"><i></i><i></i><i></i></div><div class="rv-cloud rv-cloud-two"><i></i><i></i><i></i></div><div class="rv-cyclone"><i></i><i></i><i></i></div><div class="rv-rain">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div><div class="rv-horizon"></div><span class="rv-weather-caption">PAST WEATHER → FORECAST → ILLUSTRATIVE STRESS RULE</span></div>`;
}
function councilArt() {
  const colors = ["#edc880", "#b7ddd0", "#b7ddd0", "#b7ddd0", "#a1c9ed", "#a1c9ed", "#a1c9ed", "#d5bde6", "#d5bde6", "#d5bde6"];
  return `<div class="rv-council-art" aria-hidden="true"><div class="rv-council-core"><span>PLAN</span><b>→</b><span>VERIFY</span></div>${profiles.agents.map((agent, i) => {
    const theta = -Math.PI / 2 + i * Math.PI * 2 / profiles.agents.length;
    return `<div class="rv-agent-orbit" style="--x:${Math.cos(theta) * 36}%;--y:${Math.sin(theta) * 36}%;--delay:${i * .12}s;--agent-color:${colors[i]}"><span>${esc(agent.label)}</span></div>`;
  }).join("")}</div>`;
}
function telemetryArt(tick: number) {
  const current = gridLoadAt(gridTelemetry, tick)!;
  return `<div class="rv-telemetry-art" aria-hidden="true"><div class="rv-telemetry-grid"></div><div class="rv-telemetry-bars">${grid.samples.map((sample, i) => `<div class="${i <= Math.floor(tick / 6) ? "revealed" : "future"}" style="--height:${Math.round(sample.loadMw / 70)}%;--delay:${i * .15}s"><span></span><small>${i === 0 ? "00:00" : `0${i}:00`}</small></div>`).join("")}</div><div class="rv-telemetry-signal"><span>PORTUGAL · NATIONAL LOAD</span><strong>${n(current.loadMw)} <small>MW</small></strong><em>period ended ${current.periodEndUtc.slice(11, 16)} UTC</em></div></div>`;
}

export function mountRealityPage() {
  const page = document.createElement("main");
  page.id = "reality-page";
  page.className = "reality";
  page.hidden = true;
  page.setAttribute("aria-label", "How the real system works");
  page.innerHTML = `<div class="rv-shell">
    <header class="rv-header"><a class="rv-back" href="./" id="rv-back">← Back to Nagar</a><span class="rv-wordmark">VIDYUT <i>·</i> THE REAL SYSTEM</span><a class="rv-live" href="./?historical=1">Run historical replay ↗</a></header>
    <section class="rv-hero"><div class="rv-hero-copy"><span class="rv-kicker"><i></i> DATA / MODELS / ENGINE / EVIDENCE</span><h1>See what is <em>measured.</em><br>See what is <em>modeled.</em><br>See what the city decides.</h1><p>Follow one held-out date through three trained forecasts, real grid records, ten executable utility agents, and a human-approved power decision. The animated scene explains the system; the numbers come from committed data and reports.</p><div class="rv-hero-actions"><a href="#rv-lab" class="rv-primary">Explore the system <span>↓</span></a><a href="./?historical=1" class="rv-secondary">Open the engine replay ↗</a></div></div><div class="rv-hero-art">${towers()}</div></section>
    <div class="rv-truth-strip"><span><b>REAL DATA</b> Anonymous meter demand · ERA5 weather · Portugal national load</span><span><b>TRAINED MODELS</b> XGBoost electricity and weather · Informer comparison</span><span><b>SIMULATION</b> Ten software agents · authored grid and cyclone</span></div>
    <section id="rv-lab" class="rv-lab"><div class="rv-section-heading"><span class="rv-kicker">01 / INTERACTIVE SYSTEM MAP</span><h2>Walk through the decision.</h2><p>Select a signal, then move through the three-hour replay. Values update from the saved historical episode.</p></div><div class="rv-lab-frame"><div class="rv-tabs" role="tablist" aria-label="System layer">${stages.map((stage, i) => `<button role="tab" data-stage="${stage}" aria-selected="${i === 0}" id="rv-tab-${i}">${String(i + 1).padStart(2, "0")} <span>${stage}</span></button>`).join("")}</div><div class="rv-stage-layout"><div id="rv-scene" class="rv-scene"></div><div class="rv-stage-copy"><span id="rv-stage-label" class="rv-kicker"></span><h3 id="rv-stage-title"></h3><p id="rv-stage-description"></p><div id="rv-stage-numbers"></div><p id="rv-stage-caveat" class="rv-caveat"></p></div></div><div class="rv-transport"><button id="rv-play" aria-label="Play data replay">▶</button><label for="rv-timeline">Historical replay · 2014-09-15</label><input id="rv-timeline" type="range" min="0" max="17" value="0" aria-label="Historical replay time in ten-minute ticks"><output id="rv-time">00:00</output><span>Portugal time</span></div></div></section>
    <section class="rv-flow"><div class="rv-section-heading"><span class="rv-kicker">02 / FROM INPUT TO ACTION</span><h2>One decision, five boundaries.</h2></div><div class="rv-flow-grid"><article><b>01</b><h3>Forecast</h3><p>Past-only meter and weather features enter saved models. The ten anonymous meter predictions are mapped to simulated utility demand through an illustrative kW → PU rule.</p></article><article><b>02</b><h3>Constrain</h3><p>The authored cyclone schedule sets supply and buses. A bounded weather sensitivity rule can reduce supply and feeder caps above 12 m/s wind or 5 mm/hour rain. This date triggers no extra reduction.</p></article><article><b>03</b><h3>Negotiate</h3><p>Ten deterministic TypeScript agents observe demand, make bids, exchange messages, and agree on an allocation. Unmanaged load, feeder caps, bus caps, and total supply bound the clearing.</p></article><article><b>04</b><h3>Approve</h3><p>The plan is checked against physical invariants and 30 simulated futures. Historical replay requires human approval; the engine also supports automatic guardrails. Verification compares outcomes with the plan.</p></article><article><b>05</b><h3>Observe</h3><p>Held-out demand and the latest completed ENTSO-E national load appear during execution. National load is displayed as telemetry; it cannot be treated as local available supply.</p></article></div></section>
    <section class="rv-proof"><div class="rv-section-heading"><span class="rv-kicker">THE MEASURED RESULT</span><h2>Training is visible. Limits are visible.</h2><p>Chronological train / validation / test periods keep future targets out of forecast features. Here are the committed held-out results.</p></div><div class="rv-proof-grid"><article><span>ELECTRICITY · ${n(electricity.test_windows)} TEST WINDOWS</span><h3>Demand forecast error</h3><div class="rv-proof-row"><small>Hours ahead</small><small>1 h</small><small>2 h</small><small>3 h</small></div><div class="rv-proof-row"><b>XGBoost MAE</b>${electricity.per_horizon.map((row) => `<b>${n(row.xgboost_mae_kw, 2)}</b>`).join("")}</div><div class="rv-proof-row"><b>Informer MAE</b>${electricity.per_horizon.map((row) => `<b>${n(row.informer_mae_kw, 2)}</b>`).join("")}</div><div class="rv-proof-row"><b>Yesterday MAE</b>${electricity.per_horizon.map((row) => `<b>${n(row.previous_day_mae_kw, 2)}</b>`).join("")}</div><p>All errors in kW. XGBoost is the saved model driving the selected replay.</p><a href="${repo}experiments/ml/model_comparison.json" target="_blank" rel="noopener noreferrer">Open report ↗</a></article><article><span>WEATHER · ${n(weather.split.test.windows)} TEST WINDOWS</span><h3>Wind and rainfall</h3><div class="rv-proof-row"><small>Hours ahead</small><small>1 h</small><small>2 h</small><small>3 h</small></div><div class="rv-proof-row"><b>Wind XGBoost</b>${weather.targets.wind_speed_10m.per_horizon.map((row) => `<b>${n(row.xgboost_mae, 2)}</b>`).join("")}</div><div class="rv-proof-row"><b>Rain XGBoost</b>${weather.targets.precipitation.per_horizon.map((row) => `<b>${n(row.xgboost_mae, 2)}</b>`).join("")}</div><div class="rv-proof-row"><b>Rain persistence</b>${weather.targets.precipitation.per_horizon.map((row) => `<b>${n(row.persistence_mae, 2)}</b>`).join("")}</div><p>Wind error in m/s; rain error in mm/hour. Rain XGBoost is worse than persistence on this test.</p><a href="${repo}experiments/ml/weather_model_evaluation.json" target="_blank" rel="noopener noreferrer">Open report ↗</a></article><article><span>COUNCIL · ${audit.episodeCount} FROZEN AUDIT DATES</span><h3>Fairness versus service loss</h3><div class="rv-audit-number">${audit.selectedLowerPhlThanFormerDays}<small> / ${audit.episodeCount}</small></div><p>The revised rule lowered modeled service loss versus the former council on ${audit.selectedLowerPhlThanFormerDays} dates. Static priority still had lower service loss on ${audit.episodeCount - audit.selectedLowerPhlThanStaticDays} dates. Median fairness: ${n(audit.selectedMetrics.medianFairness, 3)}.</p><a href="${repo}experiments/ml/revision_audit_summary.json" target="_blank" rel="noopener noreferrer">Open audit ↗</a></article></div></section>
    <section class="rv-agents"><div class="rv-section-heading"><span class="rv-kicker">03 / EXECUTABLE SOFTWARE AGENTS</span><h2>The ten seats are code.</h2><p>Each profile below is loaded by the same negotiation engine. Select one to inspect its real parameters and the selected replay's forecast demand. These are simulated service roles, not ten observed utilities.</p></div><div class="rv-agent-layout"><div id="rv-agent-list" class="rv-agent-list"></div><div id="rv-agent-detail" class="rv-agent-detail"></div></div></section>
    <section class="rv-sources"><div class="rv-section-heading"><span class="rv-kicker">04 / PROVENANCE</span><h2>Trace every number.</h2><p>The browser reads bundled artifacts. Historical replay works offline after build; there is no live API feed.</p></div><div class="rv-source-grid">
      <article><span>DATASET 01 · ELECTRICITY</span><h3>UCI ElectricityLoadDiagrams20112014</h3><p>${n(electricityData.rows)} hourly rows from 2013–2014; ten anonymous Portuguese customer meters. Quarter-hour readings are aggregated to hourly kW. These are not hospital or shelter meters.</p><a href="${electricityData.source}" target="_blank" rel="noopener noreferrer">Original dataset ↗</a><a href="${repo}data/processed/electricity/manifest.json" target="_blank" rel="noopener noreferrer">Selection and checksum ↗</a></article>
      <article><span>DATASET 02 · WEATHER</span><h3>Open-Meteo / Copernicus ERA5</h3><p>${n(weatherData.rows)} hourly Lisbon-area grid-cell records, 2013–2014. Temperature, precipitation and wind speed are reanalysis, not a live station or archived operational forecast. CC BY 4.0; credit Open-Meteo and Copernicus/ECMWF.</p><a href="${weatherData.documentation}" target="_blank" rel="noopener noreferrer">Historical API ↗</a><a href="${repo}data/processed/weather/manifest.json" target="_blank" rel="noopener noreferrer">Grid cell and checksum ↗</a></article>
      <article><span>DATASET 03 · GRID LOAD</span><h3>ENTSO-E Portugal hourly load</h3><p>Four replay samples extracted from its 2006–2015 archive at 100% reported coverage. MW values are national load averaged over the preceding hour, not feeder capacity or city supply.</p><a href="https://www.entsoe.eu/data/power-stats/" target="_blank" rel="noopener noreferrer">Official archive ↗</a><a href="${repo}data/processed/telemetry/pt_load_2014-09-15.json" target="_blank" rel="noopener noreferrer">Dated extract ↗</a></article>
      <article><span>AUTHORED INPUT · SIMULATION</span><h3>Network, profiles and cyclone</h3><p>${network.buses.length} buses, ${network.feeders.length} feeders, ${profiles.agents.length} agent profiles and ${scenario.events.length} scheduled scenario events. Their capacities, service dependencies, and disruptions are authored assumptions in power units (PU).</p><a href="${repo}data/network/electrical_v1.json" target="_blank" rel="noopener noreferrer">Network ↗</a><a href="${repo}data/agents/profiles.json" target="_blank" rel="noopener noreferrer">Agent profiles ↗</a><a href="${repo}data/scenarios/cyclone_24h.json" target="_blank" rel="noopener noreferrer">Scenario ↗</a></article>
    </div></section>
    <section class="rv-stack"><div class="rv-section-heading"><span class="rv-kicker">05 / OPEN SOURCE STACK</span><h2>From dataset to moving city.</h2></div><div class="rv-stack-grid"><div><b>Modeling</b><p>Python · NumPy · pandas · XGBoost · PyTorch / Informer2020</p></div><div><b>Decision engine</b><p>TypeScript · Zod contracts · Web Worker · deterministic simulation</p></div><div><b>Visual system</b><p>Three.js city and council chamber · CSS and SVG animations · Vite</p></div><div><b>Validation</b><p>Vitest unit tests · Playwright browser checks · source and model SHA-256 verification</p></div></div><p class="rv-stack-note">Informer is a trained comparison model; XGBoost drives the selected electricity replay. Weather wind uses saved XGBoost predictions. Rainfall uses validation-selected simple baselines because its trained model was weaker. <a href="${repo}src/engine/world.ts" target="_blank" rel="noopener noreferrer">Engine source ↗</a> <a href="${repo}ml/train_xgboost.py" target="_blank" rel="noopener noreferrer">Training source ↗</a> <a href="${repo}src/contract/weatherStress.ts" target="_blank" rel="noopener noreferrer">Weather rule ↗</a></p></section>
    <section class="rv-precision"><span class="rv-kicker">WHAT THIS SYSTEM CAN CLAIM</span><h2>Real signals. Explicit simulation.</h2><p>We trained and evaluated forecasting models on historical data. We run executable agents through a constrained, testable decision engine. We do not have measured local feeder outages, operational cyclone forecasts, or real hospital service outcomes. The meter-to-agent mapping, weather-to-capacity thresholds, and service impacts remain illustrative.</p><a href="./?historical=1" class="rv-primary">Run the historical decision ↗</a></section>
    <footer class="rv-footer"><span>VIDYUT PANCHAYAT · TECHNICAL WALKTHROUGH</span><a href="./">Return to city ↑</a></footer>
  </div>`;
  document.body.append(page);

  let stage: Stage = "Electricity";
  let drawnStage: Stage | null = null;
  let tick = 0;
  let selectedAgent = profiles.agents[0].id;
  let timer: number | undefined;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => page.querySelector(`#${id}`) as T;
  const renderAgent = () => {
    const agent = profiles.agents.find((item) => item.id === selectedAgent)!;
    const feeder = network.feeders.find((item) => item.id === agent.id)!;
    const forecast = replay.forecastDemand[String(tick) as keyof typeof replay.forecastDemand] as Record<string, number>;
    const actual = replay.actualDemand[String(tick) as keyof typeof replay.actualDemand] as Record<string, number>;
    $("rv-agent-list").innerHTML = profiles.agents.map((item) => `<button data-agent="${item.id}" class="${item.id === selectedAgent ? "active" : ""}"><i></i><span>${esc(item.label)}</span><small>Tier ${item.tier}</small></button>`).join("");
    $("rv-agent-detail").innerHTML = `<span class="rv-kicker">AGENT PROFILE / ${agent.id.toUpperCase()}</span><h3>${esc(agent.label)}</h3><p>Executable ${esc(agent.label.toLowerCase())} software representative. It observes demand, creates a bid, receives other bids, and participates in a constrained proposal.</p><div class="rv-detail-grid"><div><small>Priority tier</small><b>${agent.tier}</b></div><div><small>Bus</small><b>${esc(feeder.bus)}</b></div><div><small>Feeder cap</small><b>${feeder.capacity} PU</b></div><div><small>Minimum viable</small><b>${agent.minViable} PU</b></div><div><small>Forecast at ${clock(tick)}</small><b>${n(forecast[agent.id], 2)} PU</b></div><div><small>Held-out demand</small><b>${n(actual[agent.id], 2)} PU</b></div></div><p class="rv-detail-note">Backup: ${agent.reserve ? `${agent.reserve.kind}, ${agent.reserve.hours} h initial reserve` : "none"}. Depends on: ${agent.dependsOn.length ? agent.dependsOn.map((dep) => dep.agent).join(", ") : "no named upstream service"}. Demand values originate from an anonymous meter assigned illustratively to this role.</p>`;
  };
  const render = () => {
    $("rv-time").textContent = clock(tick);
    $("rv-timeline").setAttribute("value", String(tick));
    ($("rv-timeline") as HTMLInputElement).value = String(tick);
    page.querySelectorAll<HTMLButtonElement>("[data-stage]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.stage === stage)));
    const hour = Math.floor(tick / 6);
    const load = gridLoadAt(gridTelemetry, tick)!;
    const stageInfo: Record<Stage, { label: string; title: string; description: string; numbers: string; caveat: string; art: string }> = {
      Electricity: {
        label: "TRAINED DEMAND / HELD-OUT TEST", title: "A forecast crosses the wire.",
        description: "Ten anonymous UCI meters become a three-hour demand forecast. Saved XGBoost weights generate the selected replay; a trained Informer and yesterday's value are comparison baselines.",
        numbers: `<div><small>Test windows</small><b>${n(electricity.test_windows)}</b></div><div><small>Hour ${hour + 1} MAE</small><b>${n(electricity.per_horizon[hour].xgboost_mae_kw, 2)} kW</b></div><div><small>Previous-day MAE</small><b>${n(electricity.per_horizon[hour].previous_day_mae_kw, 2)} kW</b></div>`,
        caveat: "Forecast kW is converted to simulated PU using an illustrative meter-to-utility mapping. No local utility was measured.", art: towers(),
      },
      Weather: {
        label: "TRAINED WIND / HISTORICAL REANALYSIS", title: "The atmosphere becomes a forecast.",
        description: `Past-only ERA5 weather features feed saved XGBoost wind and rain models. Across ${n(weather.split.test.windows)} held-out windows, validation selected XGBoost for wind and simpler baselines for rain. The rainfall model underperformed.`,
        numbers: `<div><small>Wind, ${hour + 1} h ahead</small><b>${n(weatherReplay.weather.wind_speed_10m.rows[hour].forecast, 2)} m/s</b></div><div><small>Rain, ${hour + 1} h ahead</small><b>${n(weatherReplay.weather.precipitation.rows[hour].forecast, 2)} mm</b></div><div><small>Rule stress</small><b>${n(weatherStress(weatherForecast, tick) * 100)}%</b></div>`,
        caveat: "Weather values are retrospective ERA5 reanalysis. The weather-to-capacity rule is bounded and illustrative; no outage model was trained.", art: weatherArt(),
      },
      "The council": {
        label: "EXECUTABLE AGENTS / HUMAN APPROVAL", title: "Ten voices. One constrained plan.",
        description: "The agents are deterministic code, not ten separately trained AIs. Each sends bids into a message protocol; the engine checks electrical limits, simulates futures, and waits for human approval.",
        numbers: `<div><small>Agents</small><b>${profiles.agents.length}</b></div><div><small>Buses / feeders</small><b>${network.buses.length} / ${network.feeders.length}</b></div><div><small>Audit episodes</small><b>${audit.episodeCount}</b></div>`,
        caveat: "The city network and 24-hour cyclone are authored. A passing capacity check establishes simulated physical consistency, not real-grid safety.", art: councilArt(),
      },
      Telemetry: {
        label: "MEASURED NATIONAL LOAD / EXECUTION ONLY", title: "A real signal enters the record.",
        description: "ENTSO-E's national Portugal total load appears after each hourly period ends. Move the time control to watch the measurement advance without changing the approved plan.",
        numbers: `<div><small>Latest completed load</small><b>${n(load.loadMw)} MW</b></div><div><small>Period end UTC</small><b>${load.periodEndUtc.slice(11, 16)}</b></div><div><small>Coverage</small><b>100%</b></div>`,
        caveat: "This is archived national load, not a live stream, local feeder capacity, or available supply. Archive publication lag is unknown.", art: telemetryArt(tick),
      },
    };
    const item = stageInfo[stage];
    if (drawnStage !== stage || stage === "Telemetry") {
      $("rv-scene").innerHTML = item.art;
      drawnStage = stage;
    }
    $("rv-stage-label").textContent = item.label;
    $("rv-stage-title").textContent = item.title;
    $("rv-stage-description").textContent = item.description;
    $("rv-stage-numbers").innerHTML = item.numbers;
    $("rv-stage-caveat").textContent = item.caveat;
    renderAgent();
  };
  const pause = () => { if (timer !== undefined) window.clearInterval(timer); timer = undefined; $("rv-play").textContent = "▶"; };
  const open = () => { page.hidden = false; document.body.classList.add("reality-open"); document.title = "The Real System · Vidyut Panchayat"; page.scrollTop = 0; render(); document.dispatchEvent(new Event("open-reality")); };
  const close = () => { pause(); page.hidden = true; document.body.classList.remove("reality-open"); document.title = "Vidyut Panchayat"; document.dispatchEvent(new Event("close-reality")); };
  document.getElementById("reality-entry")?.addEventListener("click", (event) => {
    event.preventDefault();
    const url = new URL(location.href); url.searchParams.set("reality", "1");
    history.pushState({}, "", url); open();
  });
  $("rv-back").addEventListener("click", (event) => {
    event.preventDefault();
    const url = new URL(location.href); url.searchParams.delete("reality");
    history.pushState({}, "", url); close();
  });
  window.addEventListener("popstate", () => new URLSearchParams(location.search).get("reality") === "1" ? open() : close());
  page.querySelectorAll<HTMLButtonElement>("[data-stage]").forEach((button) => button.addEventListener("click", () => {
    stage = button.dataset.stage as Stage; render();
  }));
  $("rv-timeline").addEventListener("input", () => { tick = Number(($('rv-timeline') as HTMLInputElement).value); render(); });
  $("rv-play").addEventListener("click", () => {
    if (timer !== undefined) { pause(); return; }
    $("rv-play").textContent = "Ⅱ";
    timer = window.setInterval(() => { tick = tick === 17 ? 0 : tick + 1; render(); }, 750);
  });
  $("rv-agent-list").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-agent]");
    if (button?.dataset.agent) { selectedAgent = button.dataset.agent; renderAgent(); }
  });
  if (new URLSearchParams(location.search).get("reality") === "1") open();
}
