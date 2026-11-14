import { expect, it } from "vitest";
import * as THREE from "three";
import layout from "../data/scenes/city_v1.json";
import { citySceneSchema } from "../src/world3d/sceneSchema";
import { createCity } from "../src/world3d/city";
import { createMobility } from "../src/world3d/mobility";
import { disasterState, disasterWarnings } from "../src/world3d/disasterState";
import {
  createPowerEffects,
  overheadRoute,
  flowStyle,
} from "../src/world3d/powerLines";
import { initialWorld, step } from "../src/engine/world";
import { config } from "./fixtures";

const normal = step(initialWorld(config)).tick;
const crisis = structuredClone(normal);
crisis.supply = 55;
for (const a of crisis.agents)
  if (["transit", "traffic", "residential"].includes(a.id)) a.service = 0;

it("reacts to physical service and supply; resets cleanly; a software outage alone is not a street disaster", () => {
  expect(disasterState(normal).active).toBe(false);
  expect(disasterState(crisis)).toMatchObject({
    active: true,
    gathering: true,
    busSpeed: 0,
    trainSpeed: 0,
  });
  expect(disasterState(crisis).rain).toBeGreaterThan(0.7);
  const crash = structuredClone(normal);
  crash.agents.forEach((a) => (a.isDown = true));
  expect(disasterState(crash).active).toBe(false);
  expect(disasterState(null)).toEqual(disasterState(normal));
});

it("actually stops buses/trains, changes pedestrian motion and resumes ordinary motion on reset", () => {
  const a = createMobility(citySceneSchema.parse(layout)),
    b = createMobility(citySceneSchema.parse(layout));
  const matrix = (city: typeof a, name: string) =>
    Array.from(
      (city.group.getObjectByName(name) as THREE.InstancedMesh).instanceMatrix
        .array,
    );
  a.update(0, 0);
  b.update(0, 0);
  const buses = matrix(b, "buses"),
    trains = matrix(b, "trains");
  b.setDisaster(disasterState(crisis));
  for (let i = 0; i < 30; i++) {
    a.update(0.05, i * 0.05);
    b.update(0.05, i * 0.05);
  }
  expect(matrix(b, "buses")).toEqual(buses);
  expect(matrix(b, "trains")).toEqual(trains);
  expect(matrix(a, "buses")).not.toEqual(buses);
  expect(matrix(a, "trains")).not.toEqual(trains);
  expect(matrix(a, "pedestrians")).not.toEqual(matrix(b, "pedestrians"));
  expect(b.group.getObjectByName("assembly-points")!.visible).toBe(true);
  b.update(100, 100);
  const people = b.group.getObjectByName("pedestrians") as THREE.InstancedMesh;
  const markers = b.group.getObjectByName("assembly-points")!
    .children[0] as THREE.InstancedMesh;
  const person = new THREE.Matrix4(),
    point = new THREE.Matrix4();
  people.getMatrixAt(65, person);
  markers.getMatrixAt(1, point);
  expect(
    Math.hypot(
      person.elements[12] - point.elements[12],
      person.elements[14] - point.elements[14],
    ),
  ).toBeLessThan(2);
  b.setDisaster(disasterState(null));
  expect(b.group.getObjectByName("assembly-points")!.visible).toBe(false);
  b.update(0.05, 2);
  expect(matrix(b, "buses")).not.toEqual(buses);
  expect(b.group.getObjectByName("hazards")!.visible).toBe(false);
  b.setRunning(false);
  const stopped = matrix(b, "cars");
  b.update(1, 3);
  expect(matrix(b, "cars")).toEqual(stopped);
  a.dispose();
  b.dispose();
});

it("keeps every route above actual geometry, including enlarged buildings, with focus and visibility controls", () => {
  const scene = citySceneSchema.parse(layout);
  scene.facilities[0].scale = 3;
  const city = createCity(scene);
  const skyline = new THREE.Box3().setFromObject(city.group).max.y;
  const effects = createPowerEffects(city.entities, config.network, skyline);
  effects.apply(normal);
  effects.animate(0.3);
  expect(effects.getStats().routes).toBe(13);
  for (const child of effects.group.children) {
    const mesh = child.children.find(
      (o) =>
        o instanceof THREE.Mesh && o.geometry instanceof THREE.TubeGeometry,
    ) as THREE.Mesh;
    const box = new THREE.Box3().setFromObject(mesh);
    expect(box.min.y).toBeGreaterThan(skyline + 7);
  }
  effects.setFocus("hospital");
  expect(effects.getStats().routes).toBe(2);
  effects.setVisible(false);
  expect(effects.getStats().routes).toBe(0);
  effects.setVisible(true);
  expect(effects.getStats().routes).toBe(2);
  const curve = overheadRoute(
    new THREE.Vector3(1, 2, 3),
    new THREE.Vector3(1, 2, 3),
    60,
  );
  expect(
    curve.getPoints(10).every((p) => Number.isFinite(p.x) && p.y === 60),
  ).toBe(true);
  effects.dispose();
  city.dispose();
});

it("distinguishes capacity loss, zero flow, constrained and ordinary flows", () => {
  expect(flowStyle(0, 0).state).toBe("blocked");
  expect(flowStyle(0, 10).state).toBe("idle");
  expect(flowStyle(9, 10).state).toBe("busy");
  expect(flowStyle(4, 10).state).toBe("flowing");
});

it("shows grounded area warnings and clears them when service recovers", () => {
  expect(disasterWarnings(null)).toEqual([]);
  expect(disasterWarnings(normal)).toEqual([]);
  expect(disasterWarnings(crisis).map((w) => w.id)).toContain("residential");
  expect(
    disasterWarnings(crisis).find((w) => w.id === "transit")?.title,
  ).toContain("halted");
  const reduced = structuredClone(crisis);
  reduced.agents.find((a) => a.id === "transit")!.service = 0.6;
  expect(
    disasterWarnings(reduced).find((w) => w.id === "transit")?.title,
  ).toContain("reduced");
  expect(disasterState(reduced).trainSpeed).toBeGreaterThan(0);
});
