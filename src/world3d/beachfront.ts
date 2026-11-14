import * as THREE from "three";
import { CityBatch, palm, bench, lamp } from "./primitives";
import type { CityScene } from "./sceneSchema";

/** Furnished beach destination; coordinates remain local to the city extent. */
export function createBeachfront(b: CityBatch, config: CityScene) {
  const half = (config.gridSize * config.blockSize) / 2,
    x = half + 68;
  // A paved arrival plaza with inset tiles, planted edges and cafe terraces.
  b.box(x, 0.58, 0, 16, 0.28, 34, "#c7b89a");
  for (let z = -16; z <= 16; z += 2)
    for (let dx = -7; dx <= 7; dx += 2)
      b.box(
        x + dx,
        0.733,
        z,
        1.93,
        0.025,
        1.93,
        (z + dx) % 4 ? "#dbcfb5" : "#c4b99f",
      );
  for (const z of [-18, 18]) {
    b.box(x, 0.6, z, 16, 0.2, 1.4, "#d7c8a9");
    for (const dx of [-6, 6]) {
      b.box(x + dx, 0.88, z, 2.3, 0.6, 1.6, "#b8b39b");
      b.sphere(x + dx, 1.35, z, 1, 0.55, 0.65, "#718456");
      b.sphere(x + dx - 0.6, 1.5, z, 0.35, 0.3, 0.35, "#ba927d");
    }
    bench(b, x, z);
  }
  for (const z of [-26, 28]) {
    const cx = half + 65;
    // Timber cafe pavilion, serving counter and slatted pergola.
    b.box(cx, 1.9, z, 5, 2.8, 4, "#8f9c8a");
    b.box(cx, 3.42, z, 5.8, 0.25, 4.7, "#e5d9ba");
    b.box(cx, 2, z + 2.04, 3.7, 1.2, 0.1, "#355d62", 0, "glass");
    b.box(cx, 1.35, z + 2.5, 4.4, 0.2, 1.1, "#c2a582");
    for (const dx of [-2.8, 2.8])
      b.box(cx + dx, 1.85, z + 5, 0.16, 2.8, 0.16, "#8e7c5c");
    for (let n = 0; n < 10; n++)
      b.box(cx - 2.8 + n * 0.62, 3.25, z + 3.7, 0.12, 0.18, 4.4, "#c5b18a");
    for (const dx of [-1.8, 1.8]) {
      b.cylinder(cx + dx, 1.05, z + 4.6, 0.68, 0.12, "#e0d2b2");
      b.cylinder(cx + dx, 0.75, z + 4.6, 0.08, 0.6, "#758479");
      for (const dz of [-0.95, 0.95]) {
        b.box(cx + dx, 0.65, z + 4.6 + dz, 0.65, 0.12, 0.65, "#a79473");
        b.box(cx + dx, 0.95, z + 4.6 + dz * 1.27, 0.65, 0.65, 0.1, "#a79473");
      }
    }
    palm(b, cx + 7, z, 0.8, z);
  }
  // Low beach cabanas, decorative planting and festoon lights.
  for (const z of [-43, 43]) {
    const cx = half + 74;
    b.box(cx, 0.65, z, 5, 0.25, 5, "#bda98a");
    for (const dx of [-2.2, 2.2])
      for (const dz of [-2.2, 2.2])
        b.box(cx + dx, 2, z + dz, 0.13, 2.6, 0.13, "#b3a17f");
    b.box(cx, 3.35, z, 5, 0.15, 5, "#e9dfc7");
    b.box(cx, 1, z, 3.6, 0.4, 2.1, "#e8ddc5");
    for (const dx of [-1.4, 1.4])
      b.box(cx + dx, 1.35, z - 0.7, 0.6, 0.3, 0.6, "#789d96");
    palm(b, half + 48, z + 3, 1.1, z);
  }
  for (const z of [-18, 18]) {
    for (const dx of [-6.5, 6.5]) lamp(b, x + dx, z);
    for (let n = 0; n < 16; n++) {
      const dx = -6.5 + (n * 13) / 15,
        dy = 3.7 - 0.7 * Math.sin((n / 15) * Math.PI);
      if (n < 15)
        b.beam(
          [x + dx, dy, z],
          [x + dx + 13 / 15, 3.7 - 0.7 * Math.sin(((n + 1) / 15) * Math.PI), z],
          0.025,
          "#5c635b",
        );
      b.sphere(x + dx, dy - 0.12, z, 0.09, 0.13, 0.09, "#f7df9e");
    }
  }

  const group = new THREE.Group();
  group.name = "Palm Beach observation wheel";
  group.position.set(x, 15.2, 0);
  group.rotation.y = Math.PI / 2;
  const supports = new CityBatch();
  for (const z of [-2.2, 2.2])
    for (const side of [-1, 1])
      supports.beam([side * 5.5, -14.3, z], [0, 0, z * 0.6], 0.23, "#e3d6ba");
  supports.beam([0, 0, -2.5], [0, 0, 2.5], 0.38, "#9caeaa");
  group.add(supports.finish());
  const rotor = new THREE.Group(),
    spokes = new CityBatch(),
    radius = 11.2;
  const metal = new THREE.MeshStandardMaterial({
    color: "#dce0ce",
    metalness: 0.35,
    roughness: 0.4,
  });
  const rim = new THREE.TorusGeometry(radius, 0.16, 8, 96);
  for (const z of [-1.15, 1.15]) {
    const ring = new THREE.Mesh(rim, metal);
    ring.position.z = z;
    rotor.add(ring);
    for (let n = 0; n < 16; n++) {
      const a = (n * Math.PI) / 8;
      spokes.beam(
        [0, 0, z],
        [Math.cos(a) * radius, Math.sin(a) * radius, z],
        0.065,
        "#b5c6bd",
      );
      spokes.beam(
        [Math.cos(a) * radius, Math.sin(a) * radius, -1.15],
        [Math.cos(a) * radius, Math.sin(a) * radius, 1.15],
        0.07,
        "#b5c6bd",
      );
      spokes.sphere(
        Math.cos(a) * radius,
        Math.sin(a) * radius,
        z,
        0.16,
        0.16,
        0.16,
        n % 2 ? "#ebd8a4" : "#85b6aa",
      );
    }
  }
  rotor.add(spokes.finish());
  rotor.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
  group.add(rotor);
  const count = 16,
    box = new THREE.BoxGeometry(1, 1, 1),
    dummy = new THREE.Object3D();
  const bodies = new THREE.InstancedMesh(
    box,
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.55 }),
    count,
  );
  const glass = new THREE.InstancedMesh(
    box,
    new THREE.MeshStandardMaterial({
      color: "#49747b",
      metalness: 0.3,
      roughness: 0.22,
    }),
    count,
  );
  const roofs = new THREE.InstancedMesh(box, metal, count);
  for (let n = 0; n < count; n++)
    bodies.setColorAt(
      n,
      new THREE.Color(["#86aaa0", "#cbb18c", "#b87d68", "#b6c8bd"][n % 4]),
    );
  for (const mesh of [bodies, glass, roofs]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  function update(time: number) {
    const phase = time * 0.065;
    rotor.rotation.z = phase;
    for (let n = 0; n < count; n++) {
      const a = (n * Math.PI * 2) / count + phase,
        cx = Math.cos(a) * radius,
        cy = Math.sin(a) * radius;
      for (const [mesh, y, w, h, d] of [
        [bodies, -0.8, 1.8, 0.7, 2.2],
        [glass, -0.05, 1.65, 0.85, 2],
        [roofs, 0.44, 2, 0.14, 2.4],
      ] as const) {
        dummy.position.set(cx, cy + y, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
      }
    }
    for (const mesh of [bodies, glass, roofs])
      mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group, update };
}
