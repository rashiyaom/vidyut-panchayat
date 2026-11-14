import * as THREE from "three";
import { CityBatch } from "./primitives";
import type { CityScene } from "./sceneSchema";
import { roundedRoute, sampleRoute } from "./mobility";

/** A four-sided elevated metro loop above existing streets, with a station stop. */
export function createRail(config: CityScene) {
  const group = new THREE.Group(),
    b = new CityBatch();
  const edge = config.blockSize * 3,
    span = edge * 2,
    deck = 10.55;
  for (const side of [-1, 1]) {
    const k = side * edge;
    b.box(k, deck, 0, 3.7, 0.55, span - 3.7, "#aeb8b0");
    b.box(0, deck, k, span - 3.7, 0.55, 3.7, "#aeb8b0");

    for (let t = -edge + 9; t < edge - 4; t += 7) {
      b.box(k, deck + 0.3, t, 2.4, 0.09, 0.2, "#8a7967");
      b.box(t, deck + 0.3, k, 0.2, 0.09, 2.4, "#8a7967");
    }
    for (let t = -edge + 8; t < edge - 4; t += 14) {
      for (const lane of [-2.9, 2.9]) {
        b.cylinder(k + lane, 5.3, t, 0.18, 10.2, "#8d9c96");
        b.cylinder(t, 5.3, k + lane, 0.18, 10.2, "#8d9c96");
      }
      b.box(k, 10.16, t, 6.3, 0.22, 0.38, "#8d9c96");
      b.box(t, 10.16, k, 0.38, 0.22, 6.3, "#8d9c96");
    }
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.box(
        sx * (edge - 1.5),
        deck - 0.04,
        sz * (edge - 1.5),
        6,
        0.55,
        6,
        "#aeb8b0",
      );
  const route = roundedRoute(-edge, -edge, edge, edge, 2.7);
  for (let i = 0; i < route.points.length - 1; i++) {
    const a = route.points[i],
      c = route.points[i + 1],
      dx = c.x - a.x,
      dz = c.y - a.y,
      length = Math.hypot(dx, dz);
    if (length < 0.001) continue;
    const ox = (-dz / length) * 0.75,
      oz = (dx / length) * 0.75;
    for (const side of [-1, 1])
      b.beam(
        [a.x + side * ox, deck + 0.37, a.y + side * oz],
        [c.x + side * ox, deck + 0.37, c.y + side * oz],
        0.065,
        "#5c6868",
      );
  }
  // Station platforms meet the existing concourse on its eastern side.
  const station = config.facilities.find((f) => f.kind === "transit");
  if (station) {
    const x =
        (-config.gridSize * config.blockSize) / 2 +
        (station.cell[1] + 0.5) * config.blockSize +
        (station.offset?.[0] ?? 0),
      z =
        (-config.gridSize * config.blockSize) / 2 +
        (station.cell[0] + 0.5) * config.blockSize +
        (station.offset?.[1] ?? 0);
    const line =
      (-config.gridSize * config.blockSize) / 2 +
      (station.cell[1] + 1) * config.blockSize;
    b.box(line - 3.15, 10.45, z, 2.1, 0.28, 17, "#d4c7ac");
    b.box(line - 3.15, 10.67, z, 1.9, 0.08, 16.7, "#e3d9c2");
    for (const dz of [-7.8, 7.8])
      b.box(line - 3.15, 11.15, z + dz, 2.1, 0.85, 0.08, "#8a9d95");
    for (let dz = -7; dz <= 7; dz += 2.3)
      b.box(line - 3.15, 11.05, z + dz, 1.8, 0.05, 0.12, "#dbc072");
    b.box(line - 3.15, 13.25, z, 2.7, 0.18, 17.4, "#89a7a7", 0, "glass");
    for (const dz of [-7, 0, 7])
      for (const side of [-1, 1])
        b.cylinder(
          line - 3.15 + side * 1.15,
          11.9,
          z + dz,
          0.075,
          2.5,
          "#738f8e",
        );
    // A stepped access bridge crosses above the concourse roof to the upper platforms.
    for (let i = 0; i < 10; i++) {
      const sx = x + 2.5 + i * 0.75,
        sy = 5.4 + i * 0.55;
      b.box(sx, sy, z + 5.4, 0.8, 0.16, 2.1, "#dfd4bc");
      for (const side of [-1, 1])
        b.box(
          sx,
          sy + 0.42,
          z + 5.4 + side * 1.03,
          0.08,
          0.85,
          0.07,
          "#788e8a",
        );
    }
  }
  group.add(b.finish());
  const count = 6,
    dummy = new THREE.Object3D(),
    v = new THREE.Vector3(),
    cars = [
      { phase: 0.15, speed: 12 },
      { phase: 0.15 - 7 / route.length, speed: 12 },
      { phase: 0.15 - 14 / route.length, speed: 12 },
      { phase: 0.65, speed: 11 },
      { phase: 0.65 - 7 / route.length, speed: 11 },
      { phase: 0.65 - 14 / route.length, speed: 11 },
    ];
  const meshes = (color: string) => {
    const m = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.2,
      }),
      count,
    );
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
    return m;
  };
  const body = meshes("#eef1e9"),
    windows = meshes("#284e5a"),
    stripe = meshes("#66a39b"),
    roof = meshes("#dde1d8"),
    nose = meshes("#507a80"),
    lights = meshes("#f1d7a0");
  body.name = "trains";
  const pillars = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: "#d3ded7" }),
    count * 10,
  );
  pillars.frustumCulled = false;
  pillars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(pillars);
  const place = (
    m: THREE.InstancedMesh,
    i: number,
    p: ReturnType<typeof sampleRoute>,
    ox: number,
    y: number,
    oz: number,
    w: number,
    h: number,
    d: number,
  ) => {
    v.set(ox, 0, oz).applyAxisAngle(THREE.Object3D.DEFAULT_UP, p.angle);
    dummy.position.set(p.x + v.x, y, p.z + v.z);
    dummy.rotation.set(0, p.angle, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
  };
  let running = true;
  const update = (dt: number) => {
    cars.forEach((car, i) => {
      if (running) car.phase += (dt * car.speed) / route.length;
      const p = sampleRoute(route, car.phase);
      place(body, i, p, 0, 12.03, 0, 2.55, 1.75, 6.4);
      place(windows, i, p, 0, 12.42, 0, 2.59, 0.72, 5.75);
      place(stripe, i, p, 0, 11.43, 0, 2.62, 0.13, 6.25);
      place(roof, i, p, 0, 12.97, 0, 2.4, 0.12, 5.8);
      place(nose, i, p, 0, 12.28, 3.23, 2.3, 1.05, 0.08);
      place(lights, i, p, 0, 11.65, 3.29, 1.5, 0.16, 0.09);
      for (let side = 0; side < 2; side++)
        for (let n = 0; n < 5; n++)
          place(
            pillars,
            i * 10 + side * 5 + n,
            p,
            side ? 1.31 : -1.31,
            12.42,
            -2.1 + n * 1.05,
            0.08,
            0.75,
            0.1,
          );
    });
    for (const m of [body, windows, stripe, roof, nose, lights, pillars])
      m.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return {
    group,
    update,
    setRunning: (v: boolean) => {
      running = v;
    },
    trainCount: 2,
  };
}
