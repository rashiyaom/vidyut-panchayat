import * as THREE from "three";
import {
  createNightLighting,
  lightingModes,
  type LightingMode,
} from "../world3d/nightLighting";
import { CityAudio } from "../audio/CityAudio";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import sceneData from "../../data/scenes/city_v1.json";
import browserReplay from "../../data/ml/browser_replay_v1.json";
import weatherReplay from "../../data/ml/weather_browser_replay_v1.json";
import revisionAudit from "../../experiments/ml/revision_audit_summary.json";
import { citySceneSchema } from "../world3d/sceneSchema";
import type {
  CityScene,
  Facility,
  BlockStyle,
  BlockTransform,
} from "../world3d/sceneSchema";
import { createCity } from "../world3d/city";
import type { CityEntity } from "../world3d/city";
import { coastProfile } from "../world3d/coast";
import { createRendering } from "../world3d/rendering";
import { createCamera } from "../world3d/camera";
import {
  disasterState,
  disasterWarnings,
  defaultCycloneState,
} from "../world3d/disasterState";
import { createDisasterEffects } from "../world3d/disasterEffects";
import { createMobility } from "../world3d/mobility";
import "./styles.css";
import { EngineBridge, defaultConfig } from "../worker/bridge";
import { CouncilStore } from "./store";
import { mountCouncilExperience } from "../ui/CouncilExperience";
import { mountCouncil } from "../ui/CouncilPanel";
import { createPowerEffects } from "../world3d/powerLines";
import { SplitComparison } from "../compare/splitScreen";
import type { CommandInput, Tick, Strategy, Config, Allocation } from "../contract/types";

import { icons, mountExplorer } from "../ui/CityExplorer";

mountExplorer(document.querySelector<HTMLDivElement>("#app")!);
const urlParams = new URLSearchParams(location.search);
const historicalReplay = urlParams.get("historical") === "1";
const isCalmMode =
  urlParams.get("calm") === "1" || urlParams.get("weather") === "calm";
let simulationConfig: Config;
try {
  simulationConfig = defaultConfig(
    Number(urlParams.get("seed") ?? 42),
  );
  if (historicalReplay)
    simulationConfig.scenario = { ...simulationConfig.scenario, demandNoise: 0, dropRate: 0, timingJitter: 0 };
} catch (error) {
  const alert = document.createElement("main");
  alert.setAttribute("role", "alert");
  alert.style.cssText =
    "background:#152225;padding:40px;position:absolute;inset:0;z-index:100";
  alert.textContent = `Invalid simulation input: ${error instanceof Error ? error.message : String(error)}`;
  document.querySelector("#app")!.replaceChildren(alert);
  throw error;
}

let config = citySceneSchema.parse(sceneData);
const canvas = document.querySelector<HTMLCanvasElement>("#city-canvas")!;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
} catch (error) {
  $("loading").innerHTML =
    "<b>This city needs WebGL</b><span>Enable hardware acceleration in your browser and reload.</span>";
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#c8dcde");
scene.fog = new THREE.FogExp2("#c8dcde", 0.00025);
const hemi = new THREE.HemisphereLight("#dcecf0", "#b8a885", 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#fff0d2", 2.6);
sun.position.set(-80, 170, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -195;
sun.shadow.camera.right = 195;
sun.shadow.camera.top = 195;
sun.shadow.camera.bottom = -195;
sun.shadow.camera.far = 500;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.radius = 2;
sun.shadow.normalBias = 0.08;
sun.shadow.bias = -0.00015;
scene.add(sun);
const pmrem = new THREE.PMREMGenerator(renderer),
  room = new RoomEnvironment(),
  env = pmrem.fromScene(room, 0.04);
scene.environment = env.texture;
scene.environmentIntensity = 0.35;
room.dispose();
pmrem.dispose();
const view = createCamera(canvas);
const rendering = createRendering(renderer, scene, view.camera);
let city = createCity(config);
scene.add(city.group);
let mobility = createMobility(config);
scene.add(mobility.group);
const audio = new CityAudio(view.camera, view.controls.target);
audio.register(
  city.entities,
  mobility.group,
  (config.gridSize * config.blockSize) / 2,
);
let nightLighting = createNightLighting(
  config,
  city,
  mobility.group,
  scene,
  sun,
  hemi,
  renderer,
  rendering,
);
const selectOutline = new THREE.Mesh(
  new THREE.RingGeometry(14.7, 15, 4),
  new THREE.MeshBasicMaterial({
    color: "#f7d78d",
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  }),
);
selectOutline.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
selectOutline.position.y = 0.6;
selectOutline.visible = false;
scene.add(selectOutline);
let selected: CityEntity | undefined,
  paused = false,
  speed = 1,
  showLabels = false,
  lightingMode: LightingMode = "day",
  elapsed = 0,
  last = performance.now(),
  disposed = false;
const markers = new Map<string, HTMLElement>();
const facilityIcon = (f: Facility) =>
  f.kind === "hospital"
    ? icons.health
    : f.kind === "water"
      ? icons.water
      : f.kind === "substation" || f.kind === "fuel"
        ? icons.bolt
        : f.kind === "transit"
          ? icons.station
          : f.kind === "shelter" || f.kind === "residential"
            ? icons.home
            : icons.city;
function rebuildLabels() {
  $("landmarks").replaceChildren();
  $("services").replaceChildren();
  markers.clear();
  for (const e of city.entities.filter((e) => e.facility)) {
    const marker = document.createElement("button");
    marker.className = "landmark";
    marker.innerHTML = facilityIcon(e.facility!);
    marker.title = e.name;
    marker.setAttribute("aria-label", e.name);
    marker.addEventListener("click", () => select(e, true));
    $("landmarks").append(marker);
    markers.set(e.id, marker);
    const button = document.createElement("button");
    button.className = "service-item";
    const name = document.createElement("span");
    name.textContent = e.name;
    button.innerHTML = facilityIcon(e.facility!);
    button.append(name);
    button.addEventListener("click", () => select(e, true));
    $("services").append(button);
  }
  $("block-count").textContent = String(city.entities.length);
  $("service-count").textContent = config.facilities.length + " city services";
  $("activity-count").textContent =
    `${mobility.carCount} cars · ${mobility.busCount} buses · ${mobility.trainCount} trains · ${mobility.peopleCount} people`;
}
function select(e: CityEntity, focus = false) {
  setDirectoryCollapsed(true);
  selected = e;
  audio.select(e);
  $("selection").hidden = false;
  $("selection-name").textContent = e.name;
  $("selection-category").textContent = e.category;
  $("selection-description").textContent = e.description;
  let enter = document.querySelector<HTMLButtonElement>(
    "#building-enter-council",
  );
  if (!enter) {
    enter = document.createElement("button");
    enter.id = "building-enter-council";
    enter.className = "primary-button";
    enter.textContent = "Enter disaster council →";
    enter.onclick = () => document.dispatchEvent(new Event("open-council"));
    $("selection").append(enter);
  }
  enter.hidden = e.id !== "block-3-3";
  $("selection-location").textContent = e.facility
    ? "Block " + (e.facility.cell[0] + 1) + " · " + (e.facility.cell[1] + 1)
    : e.id.replace("block-", "Block ").replace("-", " · ");
  selectOutline.position.set(e.position.x, 0.62, e.position.z);
  selectOutline.rotation.set(-Math.PI / 2, 0, Math.PI / 4 - e.rotation);
  selectOutline.scale.setScalar(
    (e.scale * (config.blockSize - config.roadWidth)) / 21.2,
  );
  selectOutline.visible = true;
  markers.forEach((m, id) => m.classList.toggle("selected", id === e.id));
  if (focus)
    view.focus(
      e.position.clone().setY(e.height * 0.2),
      Math.max(65, e.height * 3.4),
    );
}
function clearSelection() {
  selected = undefined;
  audio.select();
  $("selection").hidden = true;
  selectOutline.visible = false;
  markers.forEach((m) => m.classList.remove("selected"));
}
rebuildLabels();
const directory = document.querySelector<HTMLElement>(".directory")!;
function setDirectoryCollapsed(collapsed: boolean) {
  if (!collapsed) clearSelection();
  directory.classList.toggle("collapsed", collapsed);
  $("directory-toggle").classList.toggle("active", !collapsed);
  $("directory-toggle").setAttribute("aria-expanded", String(!collapsed));
  $("directory-toggle").setAttribute(
    "aria-label",
    collapsed ? "Open city directory" : "Close city directory",
  );
}
setDirectoryCollapsed(true);
$("close-directory").onclick = () => setDirectoryCollapsed(true);
$("directory-toggle").onclick = () =>
  setDirectoryCollapsed(!directory.classList.contains("collapsed"));
const pointer = new THREE.Vector2(),
  raycaster = new THREE.Raycaster(),
  hit = new THREE.Vector3();
let downX = 0,
  downY = 0;
const activePointers = new Set<number>();
let multiTouch = false;
canvas.addEventListener("pointercancel", (e) => {
  activePointers.delete(e.pointerId);
  if (!activePointers.size) multiTouch = false;
});
canvas.addEventListener("pointerdown", (e) => {
  if (!activePointers.size) multiTouch = false;
  activePointers.add(e.pointerId);
  if (activePointers.size > 1) multiTouch = true;
  downX = e.clientX;
  downY = e.clientY;
});
canvas.addEventListener("pointerup", (e) => {
  activePointers.delete(e.pointerId);
  if (multiTouch) {
    if (!activePointers.size) multiTouch = false;
    return;
  }
  if (e.button !== 0 || Math.hypot(e.clientX - downX, e.clientY - downY) > 5)
    return;
  const rect = canvas.getBoundingClientRect();
  const viewportWidth =
    comparisonEnabled && disasterOpen ? rect.width / 2 : rect.width;
  pointer.set(
    (((e.clientX - rect.left) % viewportWidth) / viewportWidth) * 2 - 1,
    (-(e.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, view.camera);
  let best: CityEntity | undefined,
    dist = Infinity;
  for (const entity of city.entities) {
    if (raycaster.ray.intersectBox(entity.bounds, hit)) {
      const d = hit.distanceTo(raycaster.ray.origin);
      if (d < dist) {
        best = entity;
        dist = d;
      }
    }
  }
  if (best) select(best);
  else clearSelection();
});
$("close-selection").onclick = clearSelection;
$("focus-selection").onclick = () => {
  if (selected)
    view.focus(
      selected.position.clone().setY(selected.height * 0.2),
      Math.max(50, selected.height * 3),
    );
};
document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(
  (button) =>
    (button.onclick = () => {
      document
        .querySelectorAll("[data-tab]")
        .forEach((b) => b.classList.toggle("active", b === button));
      $("districts").hidden = button.dataset.tab !== "districts";
      $("services").hidden = button.dataset.tab !== "services";
    }),
);
const districts: Record<string, [number, number, number]> = {
  west: [-65, 8, 155],
  civic: [5, 25, 145],
  east: [62, -65, 170],
  water: [178, 10, 125],
};
document.querySelectorAll<HTMLButtonElement>("[data-district]").forEach(
  (button) =>
    (button.onclick = () => {
      document
        .querySelectorAll("[data-district]")
        .forEach((b) => b.classList.toggle("active", b === button));
      clearSelection();
      setDirectoryCollapsed(true);
      const d = districts[button.dataset.district!];
      if (d) view.focus(new THREE.Vector3(d[0], 0, d[1]), d[2]);
      else view.reset();
    }),
);
$("reset").onclick = () => {
  clearSelection();
  view.reset();
};
$("rotate").onclick = () => view.rotate();
$("zoom-in").onclick = () => view.zoom(0.8);
$("zoom-out").onclick = () => view.zoom(1.25);
function togglePause() {
  paused = !paused;
  mobility.setRunning(!paused);
  audio.setMoving(!paused);
  $("pause").innerHTML = paused ? icons.play : icons.pause;
  $("pause").setAttribute(
    "aria-label",
    paused ? "Resume city activity" : "Pause city activity",
  );
}
$("pause").onclick = togglePause;
$("speed").onclick = () => {
  speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
  $("speed").textContent = speed + "×";
};
$("labels").onclick = () => {
  showLabels = !showLabels;
  $("labels").classList.toggle("active", showLabels);
  $("labels").setAttribute("aria-pressed", String(showLabels));
};
function setLightingMode(mode: LightingMode) {
  if (!lightingModes.includes(mode)) throw new Error("Unknown lighting mode");
  lightingMode = mode;
  nightLighting.setMode(mode);
  const label =
    mode === "night"
      ? "Cozy night"
      : mode === "golden"
        ? "Golden hour"
        : "Daylight";
  $("daylight").innerHTML =
    `${mode === "night" ? icons.moon : icons.sun}<span>${label}</span>`;
  $("daylight").setAttribute("aria-label", `${label}. Change time of day`);
  $("daylight").title = "Cycle daylight, cozy night and golden hour";
  document.body.dataset.lighting = mode;
}
$("daylight").onclick = () =>
  setLightingMode(
    lightingModes[
      (lightingModes.indexOf(lightingMode) + 1) % lightingModes.length
    ],
  );
$("weather-toggle").onclick = () =>
  setWeather(currentWeather === "raining" ? "sunny" : "raining");
const dialog = $<HTMLDialogElement>("controls-dialog");
$("help").onclick = () => dialog.showModal();
$("close-help").onclick = () => dialog.close();
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
const shortcuts = (e: KeyboardEvent) => {
  if (document.body.classList.contains("in-council")) return;
  if (e.key === "Escape") {
    clearSelection();
    setDirectoryCollapsed(true);
    return;
  }
  if (
    dialog.open ||
    (e.target instanceof HTMLElement &&
      ["INPUT", "BUTTON", "TEXTAREA"].includes(e.target.tagName))
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePause();
  }
  if (e.code === "Home") {
    e.preventDefault();
    view.reset();
  }
};
window.addEventListener("keydown", shortcuts);
const map = $<HTMLCanvasElement>("minimap-canvas"),
  ctx = map.getContext("2d")!;
function mapBounds() {
  const h = (config.gridSize * config.blockSize) / 2;
  return { x: -h - 18, z: -h - 23, width: h * 2 + 116, depth: h * 2 + 46 };
}
function mapPoint(x: number, z: number) {
  const b = mapBounds();
  return [((x - b.x) / b.width) * 360, ((z - b.z) / b.depth) * 260];
}
function drawMap() {
  ctx.fillStyle = "#213b40";
  ctx.fillRect(0, 0, 360, 260);
  ctx.fillStyle = "#283e3d";
  const half = (config.gridSize * config.blockSize) / 2;
  const start = mapPoint(-half, -half),
    end = mapPoint(half, half);
  ctx.fillRect(start[0], start[1], end[0] - start[0], end[1] - start[1]);
  ctx.fillStyle = "#8d9879";
  ctx.beginPath();
  for (const side of [-1, 1])
    for (let i = 0; i <= 32; i++) {
      const z = half * 0.84 * (-1 + (2 * (side < 0 ? i : 32 - i)) / 32),
        c = coastProfile(half, z);
      const p = mapPoint(c.center + side * c.extent * 0.9, z);
      if (side === -1 && i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#738e7e";
  ctx.lineWidth = 2;
  for (const z of [-config.blockSize * 2, config.blockSize * 2]) {
    const a = mapPoint(half, z),
      b = mapPoint(half + 57, z);
    ctx.beginPath();
    ctx.moveTo(...(a as [number, number]));
    ctx.lineTo(...(b as [number, number]));
    ctx.stroke();
  }
  for (const e of city.entities) {
    const p = mapPoint(e.position.x - 9, e.position.z - 9);
    ctx.fillStyle = e.facility
      ? "#91baa5"
      : e.category === "Public park"
        ? "#4c7561"
        : "#53726c";
    ctx.fillRect(
      p[0],
      p[1],
      (18 / mapBounds().width) * 360,
      (18 / mapBounds().depth) * 260,
    );
  }
  const a = mapPoint(view.controls.target.x, view.controls.target.z);
  ctx.strokeStyle = "#d6e6d8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(a[0], a[1], 17, 13, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#d6e6d8";
  ctx.beginPath();
  ctx.arc(a[0], a[1], 3, 0, Math.PI * 2);
  ctx.fill();
}
map.onclick = (e) => {
  const rect = map.getBoundingClientRect();
  const b = mapBounds();
  view.focus(
    new THREE.Vector3(
      ((e.clientX - rect.left) / rect.width) * b.width + b.x,
      0,
      ((e.clientY - rect.top) / rect.height) * b.depth + b.z,
    ),
    140,
  );
};
function resize() {
  const impact = document.body.classList.contains("council-city-impact");
  const width = impact ? canvas.parentElement!.clientWidth : window.innerWidth,
    height = impact ? canvas.parentElement!.clientHeight : window.innerHeight;
  renderer.setSize(width, height, false);
  rendering.resize(width, height);
  view.resize(width / height);
}
window.addEventListener("resize", resize);
resize();
const projected = new THREE.Vector3();
let frames = 0;
function animate(now: number) {
  if (disposed) return;
  if (
    document.body.classList.contains("in-council") &&
    !document.body.classList.contains("council-city-impact")
  ) {
    last = now;
    requestAnimationFrame(animate);
    return;
  }
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const activitySpeed = disasterOpen
    ? Number(
        (document.getElementById("room-sim-speed") as HTMLSelectElement).value,
      )
    : speed;
  const moving = disasterOpen || !paused;
  if (moving) elapsed += dt * activitySpeed;
  view.update(dt);
  mobility.update(moving ? dt * activitySpeed : 0, elapsed);
  nightLighting.update(dt, mobility.getResponse().rain);
  disasterEffects.update(elapsed, mobility.getResponse());
  city.water.material.uniforms.time.value = elapsed;
  city.update(elapsed);
  for (const e of city.entities) {
    const marker = markers.get(e.id);
    if (!marker) continue;
    projected
      .copy(e.position)
      .setY(e.height + 2)
      .project(view.camera);
    const visible =
      showLabels &&
      projected.z < 1 &&
      projected.z > -1 &&
      Math.abs(projected.x) < 0.95 &&
      Math.abs(projected.y) < 0.95;
    marker.hidden = !visible;
    if (visible)
      marker.style.transform =
        "translate(" +
        (projected.x * 0.5 + 0.5) * window.innerWidth +
        "px," +
        (-projected.y * 0.5 + 0.5) * window.innerHeight +
        "px) translate(-50%,-100%)";
  }
  powerEffects.animate(elapsed);
  if (comparisonEnabled && comparisonPair && disasterOpen) {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    const camera = view.camera;
    camera.aspect = w / 2 / h;
    camera.updateProjectionMatrix();
    renderer.setScissorTest(true);
    renderer.info.reset();
    powerEffects.apply(comparisonPair[0]);
    powerEffects.animate(elapsed);
    city.applyTick(comparisonPair[0]);
    renderer.setViewport(0, 0, w / 2, h);
    renderer.setScissor(0, 0, w / 2, h);
    renderer.render(scene, camera);
    powerEffects.apply(comparisonPair[1]);
    powerEffects.animate(elapsed);
    city.applyTick(comparisonPair[1]);
    renderer.setViewport(w / 2, 0, w / 2, h);
    renderer.setScissor(w / 2, 0, w / 2, h);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  } else rendering.render();
  if (frames++ % 8 === 0) drawMap();
  if (frames === 2) $("loading").classList.add("loaded");
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
function setScene(input: unknown) {
  const next = citySceneSchema.parse(input);
  for (const id of [
    "substation",
    ...simulationConfig.network.feeders.map((f) => f.id),
  ]) {
    if (!next.facilities.some((f) => f.id === id))
      throw new Error(`Electrical facility missing from city: ${id}`);
  }
  const built = createCity(next),
    moving = createMobility(next);
  nightLighting.dispose();
  city.dispose();
  mobility.dispose();
  config = next;
  powerEffects.dispose();
  city = built;
  powerEffects = createPowerEffects(
    city.entities,
    simulationConfig.network,
    new THREE.Box3().setFromObject(city.group).max.y,
  );
  scene.add(powerEffects.group);
  if (disasterOpen && councilStore.tick) {
    powerEffects.apply(councilStore.tick);
    city.applyTick(councilStore.tick);
  }
  mobility = moving;
  nightLighting = createNightLighting(
    config,
    city,
    mobility.group,
    scene,
    sun,
    hemi,
    renderer,
    rendering,
  );
  nightLighting.setMode(lightingMode);
  audio.register(
    city.entities,
    mobility.group,
    (config.gridSize * config.blockSize) / 2,
  );
  mobility.setRunning(disasterOpen || !paused);
  disasterEffects.dispose();
  disasterEffects = createDisasterEffects(
    config.gridSize * config.blockSize + 80,
  );
  scene.add(city.group, mobility.group, disasterEffects.group);
  applyDisaster(
    disasterOpen ? councilStore.tick : null,
    !disasterOpen && isCalmMode,
  );
  syncSignalControls();
  renderer.shadowMap.needsUpdate = true;
  clearSelection();
  rebuildLabels();
}
const api = {
  setLightingMode,
  setWeather,
  getWeather: () => currentWeather,
  getLighting: () => nightLighting.stats(),
  getAudio: () => audio.diagnostics(),
  getScene: () => structuredClone(config),
  setScene,
  updateBuilding(
    id: string,
    patch: Partial<
      Pick<Facility, "cell" | "offset" | "rotation" | "scale" | "color">
    >,
  ) {
    const next = structuredClone(config),
      index = next.facilities.findIndex((f) => f.id === id);
    if (index < 0) throw new Error("Unknown facility: " + id);
    Object.assign(next.facilities[index], patch);
    setScene(next);
  },
  updateBlock(
    row: number,
    col: number,
    patch: Partial<BlockTransform> & { style?: BlockStyle },
  ) {
    const next = structuredClone(config),
      key = `${row},${col}`;
    if (next.facilities.some((f) => f.cell[0] === row && f.cell[1] === col))
      throw new Error("Use updateBuilding for city services.");
    if (patch.style && next.districts[row]?.[col] === "P")
      throw new Error(
        "Change the district type before assigning a building style to a park.",
      );
    const { style, ...transform } = patch;
    if (style) next.blockStyles[key] = style;
    next.blockTransforms[key] = {
      ...(next.blockTransforms[key] ?? {
        offset: [0, 0],
        rotation: 0,
        scale: 1,
      }),
      ...transform,
    };
    setScene(next);
  },
  focus(id: string) {
    const e = city.entities.find((e) => e.id === id);
    if (e) select(e, true);
  },
  getSimulation: () => ({
    tick: councilStore.tick,
    plan: councilStore.plan,
    presim: councilStore.presim,
    state: councilStore.state,
    branch: councilStore.branch,
    verification: councilStore.verification,
  }),
  command: (command: CommandInput) => dispatchSimulation(command),
  getStats: () => ({
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    buildings: city.entities.length,
    ambientPaused: paused,
    ambientSpeed: speed,
    ambientTime: elapsed,
    vehicles: mobility.carCount,
    buses: mobility.busCount,
    trains: mobility.trainCount,
    pedestrians: mobility.peopleCount,
    disaster: mobility.getResponse(),
    signals: powerEffects.getStats(),
  }),
  resetView: () => view.reset(),
};
declare global {
  interface Window {
    vidyutCity: typeof api;
  }
}
window.vidyutCity = api;
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    disposed = true;
    audio.dispose();
    nightLighting.dispose();
    councilExperience.dispose();
    bridge.dispose();
    comparison.dispose();
    powerEffects.dispose();
    view.dispose();
    city.dispose();
    mobility.dispose();
    disasterEffects.dispose();
    selectOutline.geometry.dispose();
    (selectOutline.material as THREE.Material).dispose();
    sun.shadow.dispose();
    rendering.dispose();
    env.dispose();
    renderer.dispose();
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", shortcuts);
  });
export type { CityScene };

const councilStore = new CouncilStore();
const bridge = new EngineBridge();
let powerEffects = createPowerEffects(
  city.entities,
  simulationConfig.network,
  new THREE.Box3().setFromObject(city.group).max.y,
);
scene.add(powerEffects.group);
let disasterEffects = createDisasterEffects(
  config.gridSize * config.blockSize + 80,
);
scene.add(disasterEffects.group);
let currentWeather: "raining" | "sunny" = isCalmMode ? "sunny" : "raining";

function updateWeatherToggle(weather: "raining" | "sunny") {
  currentWeather = weather;
  const toggle = document.getElementById("weather-toggle");
  if (!toggle) return;
  const isRain = weather === "raining";
  toggle.innerHTML = `${isRain ? icons.cloudRain : icons.sun}<span>${isRain ? "Raining" : "Sunny day"}</span>`;
  toggle.title = isRain
    ? "Currently raining · Click for sunny day"
    : "Currently sunny · Click for raining";
  toggle.setAttribute(
    "aria-label",
    `${isRain ? "Raining" : "Sunny day"}. Toggle between raining and sunny day.`,
  );
  toggle.classList.toggle("is-raining", isRain);
}

function setWeather(weather: "raining" | "sunny") {
  if (weather === "raining") {
    applyDisaster(null, false, true);
  } else {
    applyDisaster(null, true);
  }
}

function applyDisaster(
  tick: Tick | null,
  forceCalm = false,
  forceCyclone = false,
) {
  const state = forceCalm
    ? disasterState(tick, simulationConfig.scenario.initialSupply)
    : forceCyclone
      ? defaultCycloneState()
      : isCalmMode
        ? disasterState(tick, simulationConfig.scenario.initialSupply)
        : tick
          ? disasterState(tick, simulationConfig.scenario.initialSupply)
          : defaultCycloneState();
  renderSignalReadout(tick);
  const warningPanel = document.getElementById("street-warnings");
  if (warningPanel) {
    const warnings = disasterWarnings(tick);
    warningPanel.hidden = warnings.length === 0;
    warningPanel.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = "AREA WARNINGS · ILLUSTRATIVE";
    warningPanel.append(heading);
    for (const warning of warnings) {
      const button = document.createElement("button");
      button.dataset.warning = warning.id;
      const title = document.createElement("b");
      title.textContent = warning.title;
      const detail = document.createElement("span");
      detail.textContent = warning.detail;
      button.append(title, detail);
      button.onclick = () => focusStreet(warning.id);
      warningPanel.append(button);
    }
  }
  mobility.setDisaster(state);
  audio.setDisaster(state);
  disasterEffects.update(elapsed, state);
  const title = document.getElementById("street-condition"),
    detail = document.getElementById("street-response");
  if (title && detail) {
    title.textContent = state.active
      ? tick
        ? "City under disruption"
        : "Cyclone in progress · Preseeded disruption"
      : tick
        ? "City moving normally"
        : "Waiting for a decision";
    detail.textContent = state.active
      ? `Cars slow and stop with hazard lights. ${state.busSpeed === 0 ? "Buses and trains are halted." : "Buses and trains run at reduced speed."} ${state.gathering ? "People run toward amber assembly markers or wait there." : "Pedestrians move with urgency."}${state.rain > 0.15 ? " Wind-driven rain illustrates cyclone disruption." : ""}`
      : tick
        ? "Services support ordinary street activity. Advance the disaster clock to see changing conditions."
        : "Approve a plan, then advance the simulation to see its effect.";
  }
  updateWeatherToggle(state.rain > 0.15 ? "raining" : "sunny");
}
applyDisaster(null);
function renderSignalReadout(tick: Tick | null) {
  const el = document.getElementById("signal-readout");
  if (!el) return;
  const focus = (document.getElementById("signal-focus") as HTMLSelectElement)
    .value;
  const feeder = simulationConfig.network.feeders.find((f) => f.id === focus);
  const flow = tick?.lines.find((l) => l.id === `feeder-${focus}`);
  el.textContent =
    feeder && flow
      ? `Power station → ${feeder.bus} district → ${focus}. Receiving ${flow.flow.toFixed(1)} PU; line capacity ${flow.capacity.toFixed(1)} PU.${flow.capacity <= 0 ? " Connection unavailable." : flow.flow === 0 ? " No power flowing." : flow.flow / flow.capacity >= 0.9 ? " Line nearly full." : " Power flowing."}`
      : "Choose a facility to follow its electricity supply. Blue: flowing · Amber: ≥90% full · Red: unavailable · Grey: no flow.";
}
function syncSignalControls() {
  const focus = document.getElementById(
    "signal-focus",
  ) as HTMLSelectElement | null;
  const visible = document.getElementById(
    "signal-visible",
  ) as HTMLInputElement | null;
  powerEffects.setFocus(focus?.value ?? "all");
  powerEffects.setVisible(visible?.checked ?? true);
  renderSignalReadout(councilStore.tick);
}
let comparisonEnabled = false,
  comparisonPair: [Tick, Tick] | null = null;
const comparisonLabels = document.createElement("div");
comparisonLabels.className = "comparison-labels";
comparisonLabels.hidden = true;
document.querySelector("#app")!.append(comparisonLabels);
const comparison = new SplitComparison(simulationConfig, (tick) => {
  if (councilStore.tick?.t === tick.t) {
    comparisonPair = [councilStore.tick, tick];
    panel.comparison(councilStore.tick, tick);
  }
});
function showError(error: unknown) {
  councilStore.error = error instanceof Error ? error.message : String(error);
  panel.render();
  councilExperience.render();
}
function sendSimulation(command: CommandInput) {
  void dispatchSimulation(command).catch(showError);
}
async function dispatchSimulation(command: CommandInput): Promise<void> {
  councilStore.error = "";
  if (command.type === "TOGGLE_AGENT") {
    simulationConfig.enabledAgents = simulationConfig.enabledAgents.filter(
      (id) => id !== command.id,
    );
    if (command.enabled) simulationConfig.enabledAgents.push(command.id);
  }
  if (command.type === "TOGGLE_AGENT" || command.type === "TRIGGER_EVENT")
    comparison.intervene(command, (councilStore.tick?.t ?? -1) + 1);
  return bridge.send(command);
}
const panel = mountCouncil(
  simulationConfig,
  councilStore,
  sendSimulation,
  (value) => {
    comparisonEnabled = value !== "off";
    document.getElementById("impact-comparison-note")!.hidden =
      !comparisonEnabled;
    comparisonLabels.hidden = !comparisonEnabled;
    if (comparisonEnabled) {
      comparison.setStrategy(value as Strategy);
      comparisonPair = null;
      comparisonLabels.innerHTML = `<span>Council · same seed</span><span>${value} · same tick</span>`;
      if (councilStore.tick)
        void comparison.sync(councilStore.tick.t).catch(showError);
    } else if (councilStore.tick) {
      powerEffects.apply(councilStore.tick);
      city.applyTick(councilStore.tick);
    }
  },
);
if (historicalReplay) {
  (document.getElementById("sim-baseline") as HTMLSelectElement).disabled = true;
  const badge = document.createElement("div");
  badge.className = "historical-replay-badge";
  const auditLabel = revisionAudit.passAllCriteria ? "revised policy passed 30-date simulation audit" : "policy audit criteria missed";
  badge.textContent = `HISTORICAL REPLAY · ${browserReplay.origin.slice(0, 10)} · ${auditLabel} · illustrative utility mapping`;
  document.querySelector("#app")!.append(badge);
}
let engineInitialized = false;
let disasterOpen = false;
const councilExperience = mountCouncilExperience(
  simulationConfig,
  councilStore,
  (command) => {
    void dispatchSimulation(command).catch(showError);
  },
  {
    enter() {
      audio.setCouncil(true);
      audio.setMoving(true);
      disasterOpen = true;
      mobility.setRunning(true);
      applyDisaster(councilStore.tick);
      if (!engineInitialized) {
        engineInitialized = true;
        void bridge
          .send({ type: "INIT", config: simulationConfig,
            ...(historicalReplay ? { historicalReplay: {
              origin: browserReplay.origin,
              modelSha256: browserReplay.modelSha256,
              actualDemand: Array.from({ length: 18 }, (_, t) => browserReplay.actualDemand[String(t) as keyof typeof browserReplay.actualDemand] as Allocation),
              forecastDemand: Array.from({ length: 18 }, (_, t) => browserReplay.forecastDemand[String(t) as keyof typeof browserReplay.forecastDemand] as Allocation),
              supplyFraction: 1 as const,
              fillFraction: browserReplay.policy.fillFraction,
              priorityBlend: browserReplay.policy.priorityBlend,
              ...(weatherReplay.originPortugal.slice(0, 10) === browserReplay.origin.slice(0, 10) ? {
                weatherForecast: {
                  originPortugal: weatherReplay.originPortugal,
                  windSpeed: weatherReplay.weather.wind_speed_10m.rows.map((row) => row.forecast),
                  precipitation: weatherReplay.weather.precipitation.rows.map((row) => row.forecast),
                },
              } : {}),
            } } : {}),
          })
          .then(() => bridge.send({ type: "REQUEST_PLAN", horizonTicks: 18 }))
          .catch(showError);
      }
    },
    exit() {
      audio.setCouncil(false);
      audio.setMoving(!paused);
      disasterOpen = false;
      applyDisaster(null, true);
      mobility.setRunning(!paused);
      if (engineInitialized)
        void bridge.send({ type: "PAUSE" }).catch(showError);
      powerEffects.group.visible = false;
      city.resetService();
      for (const e of city.entities) {
        const marker = markers.get(e.id);
        if (marker) marker.title = e.name;
      }
      if (selected)
        $("selection-description").textContent = selected.description;
      comparisonLabels.hidden = true;
    },
    impact(visible) {
      audio.setCouncil(disasterOpen && !visible);
      document.body.classList.toggle("council-city-impact", visible);
      if (visible) {
        document.getElementById("city-impact-view")!.prepend(canvas);
        canvas.inert = false;
        document.getElementById("city-impact-view")!.append(comparisonLabels);
        comparisonLabels.hidden = !comparisonEnabled;
      } else if (canvas.parentElement?.id === "city-impact-view") {
        document.getElementById("app")!.prepend(canvas);
        document.getElementById("app")!.append(comparisonLabels);
        comparisonLabels.hidden = true;
      }
      requestAnimationFrame(resize);
      if (visible && councilStore.tick) {
        powerEffects.apply(councilStore.tick);
        city.applyTick(councilStore.tick);
      }
      if (!visible) canvas.inert = false;
    },
  },
);
document
  .getElementById("signal-focus")!
  .addEventListener("change", syncSignalControls);
document
  .getElementById("signal-visible")!
  .addEventListener("change", syncSignalControls);
function focusStreet(id = "residential") {
  const entity = city.entities.find((e) => e.id === id);
  if (!entity) return;
  if (id === "transit") view.focus(entity.position.clone().setY(11), 48);
  else if (entity.facility) {
    const [row, col] = entity.facility.cell;
    view.focus(
      mobility.pedestrianPosition(row * config.gridSize + col),
      30,
      1.3,
      new THREE.Vector3(0.5, 1.8, 0.7),
    );
  } else view.focus(entity.position, 48);
}
document.getElementById("impact-street-view")!.addEventListener("click", () => {
  const selected = (
    document.getElementById("signal-focus") as HTMLSelectElement
  ).value;
  focusStreet(selected === "all" ? "residential" : selected);
});
document
  .getElementById("impact-transit-view")!
  .addEventListener("click", () => focusStreet("transit"));
document
  .getElementById("impact-city-view")!
  .addEventListener("click", () => view.reset());
let panelFrame = 0;
bridge.subscribe((reply) => {
  councilStore.apply(reply);
  if (reply.type === "TICK") {
    simulationConfig.enabledAgents = reply.tick.agents
      .filter((a) => a.enabled)
      .map((a) => a.id);
    if (disasterOpen) {
      applyDisaster(reply.tick);
      powerEffects.apply(reply.tick);
      city.applyTick(reply.tick);
    }
    if (comparisonEnabled) void comparison.sync(reply.tick.t).catch(showError);
    for (const a of reply.tick.agents) {
      const marker = markers.get(a.id);
      if (marker)
        marker.title = `${a.id}: ${a.status}, ${(a.service * 100).toFixed(0)}% service, ${a.allocated.toFixed(2)} PU${a.isDown ? " · HOLD" : ""}`;
    }
    if (disasterOpen && selected?.facility) {
      const a = reply.tick.agents.find((a) => a.id === selected!.id);
      if (a)
        $("selection-description").textContent =
          `${selected.description} Current service: ${(a.service * 100).toFixed(0)}% (${a.status}). Grid ${a.allocated.toFixed(2)} / ${a.demand.toFixed(2)} PU; backup ${a.reserveHours.toFixed(2)}h.`;
    }
  }
  if (!panelFrame)
    panelFrame = requestAnimationFrame(() => {
      panelFrame = 0;
      panel.render();
      councilExperience.render();
    });
});
$("speed").title = "City activity speed";
$("pause").title = "Pause city activity (Space)";
panel.render();
