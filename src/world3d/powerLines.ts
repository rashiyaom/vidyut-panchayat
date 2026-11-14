import * as THREE from "three";
import type { Network, Tick } from "../contract/types";
import type { CityEntity } from "./city";

export const powerColors = {
  flowing: "#007dca",
  busy: "#d67700",
  blocked: "#dc3545",
  idle: "#64748b",
};
export function flowStyle(flow: number, capacity: number) {
  const state =
    capacity <= 0
      ? "blocked"
      : flow <= 0
        ? "idle"
        : flow / capacity >= 0.9
          ? "busy"
          : "flowing";
  return { state, color: powerColors[state] };
}

/** A schematic layer entirely above the skyline, never through city geometry. */
export function overheadRoute(
  a: THREE.Vector3,
  b: THREE.Vector3,
  height: number,
) {
  const points = [
    new THREE.Vector3(a.x, height, a.z),
    new THREE.Vector3(b.x, height, a.z),
    new THREE.Vector3(b.x, height, b.z),
  ];
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < points.length; i++)
    if (points[i].distanceTo(points[i - 1]) > 0.001)
      curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
  // Configurable layouts may place a hub directly above a facility.
  if (!curve.curves.length)
    curve.add(
      new THREE.LineCurve3(
        points[0],
        points[0].clone().add(new THREE.Vector3(0.01, 0, 0)),
      ),
    );
  return curve;
}

function makeLabel() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthWrite: false,
      sizeAttenuation: false,
      fog: false,
    }),
  );
  sprite.scale.set(0.19, 0.032, 1);
  let previous = "";
  return {
    sprite,
    texture,
    set(text: string) {
      if (text === previous) return;
      previous = text;
      ctx.clearRect(0, 0, 384, 64);
      ctx.fillStyle = "#102c39";
      ctx.fillRect(0, 0, 384, 64);
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 25px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 192, 32, 370);
      texture.needsUpdate = true;
    },
  };
}

export function createPowerEffects(
  entities: CityEntity[],
  network: Network,
  skyline = Math.max(...entities.map((e) => e.height)),
) {
  const group = new THREE.Group();
  const positions = new Map(
    entities.filter((e) => e.facility).map((e) => [e.id, e.position.clone()]),
  );
  for (const id of [network.root, ...network.feeders.map((f) => f.id)])
    if (!positions.has(id))
      throw new Error(`Electrical facility missing from city: ${id}`);
  network.buses.forEach((b) => {
    const members = network.feeders
      .filter((f) => f.bus === b.id)
      .map((f) => positions.get(f.id)!);
    positions.set(
      b.id,
      members
        .reduce((sum, p) => sum.add(p), new THREE.Vector3())
        .divideScalar(members.length || 1),
    );
  });
  const endpoints = [
    ...network.buses.map((b) => ({
      id: `bus-${b.id}`,
      from: network.root,
      to: b.id,
      bus: b.id,
      title: `${b.id.toUpperCase()} DISTRICT`,
    })),
    ...network.feeders.map((f) => ({
      id: `feeder-${f.id}`,
      from: f.bus,
      to: f.id,
      bus: f.bus,
      title: f.id.charAt(0).toUpperCase() + f.id.slice(1),
    })),
  ];
  const lines = endpoints.map((e) => {
    const height =
      skyline + 8 + network.buses.findIndex((b) => b.id === e.bus) * 6;
    const curve = overheadRoute(
      positions.get(e.from)!,
      positions.get(e.to)!,
      height,
    );
    const routeGroup = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.65, 6, false),
      new THREE.MeshBasicMaterial({ color: powerColors.flowing, fog: false }),
    );
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 4, 8),
      new THREE.MeshBasicMaterial({ color: powerColors.flowing, fog: false }),
    );
    const endpoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 8, 6),
      new THREE.MeshBasicMaterial({ color: powerColors.flowing, fog: false }),
    );
    endpoint.position.copy(curve.getPoint(1));
    const label = makeLabel();
    if (label) {
      label.sprite.position
        .copy(endpoint.position)
        .add(new THREE.Vector3(0, 3.7, 0));
      routeGroup.add(label.sprite);
    }
    routeGroup.add(mesh, arrow, endpoint);
    group.add(routeGroup);
    return {
      ...e,
      curve,
      mesh,
      arrow,
      endpoint,
      label,
      routeGroup,
      flowing: false,
    };
  });
  let focus = "all",
    shown = true,
    lastTick: Tick | null = null;
  function filter() {
    const bus = network.feeders.find((f) => f.id === focus)?.bus;
    for (const line of lines) {
      if (line.label)
        line.label.sprite.visible =
          focus === "all" ? line.id.startsWith("bus-") : line.to === focus;
      line.routeGroup.visible =
        shown &&
        (focus === "all" ||
          line.to === focus ||
          (line.id.startsWith("bus-") && line.bus === bus));
    }
  }
  group.visible = false;
  filter();
  return {
    group,
    setFocus(id: string) {
      focus = id;
      filter();
    },
    setVisible(value: boolean) {
      shown = value;
      filter();
    },
    getStats: () => ({
      visible: group.visible && shown,
      focus,
      routes: lines.filter((l) => l.routeGroup.visible && group.visible).length,
      clearance: skyline + 8,
    }),
    apply(tick: Tick) {
      group.visible = true;
      if (lastTick === tick) return;
      lastTick = tick;
      for (const line of lines) {
        const flow = tick.lines.find((l) => l.id === line.id);
        const { state, color } = flowStyle(
          flow?.flow ?? 0,
          flow?.capacity ?? 0,
        );
        line.flowing = state === "flowing" || state === "busy";
        for (const mesh of [line.mesh, line.arrow, line.endpoint])
          mesh.material.color.set(color);
        line.arrow.visible = line.flowing;
        line.label?.set(
          `${line.title} · ${(flow?.flow ?? 0).toFixed(1)} / ${(flow?.capacity ?? 0).toFixed(0)} PU`,
        );
      }
    },
    animate(time: number) {
      for (const line of lines) {
        const phase = (time * 0.16) % 1;
        line.arrow.position.copy(line.curve.getPoint(phase));
        line.arrow.quaternion.setFromUnitVectors(
          THREE.Object3D.DEFAULT_UP,
          line.curve.getTangent(phase).normalize(),
        );
      }
    },
    dispose() {
      for (const line of lines) line.label?.texture.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite)
          (o.material as THREE.Material).dispose();
      });
      group.removeFromParent();
    },
  };
}
