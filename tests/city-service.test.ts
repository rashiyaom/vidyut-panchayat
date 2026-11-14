import { expect, it } from "vitest";
import * as THREE from "three";
import { CityBatch } from "../src/world3d/primitives";
it("tick service dims only tagged facility instances and restores authored colors", () => {
  const batch = new CityBatch();
  batch.setOwner("hospital");
  batch.box(0, 2, 0, 1, 1, 1, "#ffffff");
  batch.setOwner();
  batch.box(3, 2, 0, 1, 1, 1, "#ffffff");
  const group = batch.finish(),
    mesh = group.children[0] as THREE.InstancedMesh;
  const matrices = Array.from(mesh.instanceMatrix.array);
  const first = new THREE.Color(),
    other = new THREE.Color();
  batch.setService("hospital", 0);
  mesh.getColorAt(0, first);
  mesh.getColorAt(1, other);
  expect(first.r).toBeCloseTo(0.25);
  expect(other.r).toBeCloseTo(1);
  batch.setService("hospital", 1);
  mesh.getColorAt(0, first);
  expect(first.r).toBeCloseTo(1);
  expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrices);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});

it("night window emissions follow service loss without dimming unrelated windows", () => {
  const batch = new CityBatch();
  batch.setOwner("hospital");
  batch.box(0, 2, 0, 1, 1, 0.1, "#587c89", 0, "glass");
  batch.setOwner();
  batch.box(3, 2, 0, 1, 1, 0.1, "#587c89", 0, "glass");
  const group = batch.finish(),
    mesh = group.children[0] as THREE.InstancedMesh;
  const service = mesh.geometry.getAttribute("nightService");
  batch.setService("hospital", 0);
  expect(service.getX(0)).toBe(0);
  expect(service.getX(1)).toBe(1);
  batch.setService("hospital", 0.5);
  expect(service.getX(0)).toBe(0.5);
  expect((mesh.material as THREE.Material).userData.nightUniform.value).toBe(0);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});
