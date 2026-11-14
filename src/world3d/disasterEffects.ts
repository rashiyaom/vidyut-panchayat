import * as THREE from "three";
import type { DisasterState } from "./disasterState";
import { seededRandom } from "./sceneSchema";

/** One draw call for wind-driven rain; a visual cue, not a weather model. */
export function createDisasterEffects(extent: number) {
  const rng = seededRandom(823),
    count = 900;
  const seeds = Array.from({ length: count }, () => [rng(), rng(), rng()]);
  const coordinates = new Float32Array(count * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(coordinates, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const material = new THREE.LineBasicMaterial({
    color: "#d5eeff",
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const group = new THREE.LineSegments(geometry, material);
  group.frustumCulled = false;
  group.visible = false;
  return {
    group,
    update(time: number, state: DisasterState) {
      group.visible = state.rain > 0.15;
      if (!group.visible) return;
      geometry.setDrawRange(0, Math.floor(count * state.rain) * 2);
      for (let i = 0; i < count; i++) {
        const [sx, sy, sz] = seeds[i];
        const x = ((sx * extent + time * 9) % extent) - extent / 2;
        const y = (((sy * 100 - time * 34) % 100) + 100) % 100;
        const z = sz * extent - extent / 2;
        coordinates.set([x, y, z, x - 1.5, y + 4, z + 0.4], i * 6);
      }
      geometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
