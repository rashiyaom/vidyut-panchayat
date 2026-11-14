import * as THREE from "three";
import type { Tick } from "../contract/types";
export function createBidArcs(positions: Map<string, THREE.Vector3>) {
  const group = new THREE.Group();
  function clear() {
    for (const child of [...group.children]) {
      const line = child as THREE.Line;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      group.remove(child);
    }
  }
  return {
    group,
    update(tick: Tick) {
      clear();
      const seen = new Set<string>();
      for (const m of tick.negotiation.messages) {
        if (
          m.type !== "BID" ||
          !m.delivered ||
          m.recipient === "all" ||
          m.sender === m.recipient
        )
          continue;
        const key = [m.sender, m.recipient].sort().join(":");
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size > 12) break;
        const a = positions.get(m.sender),
          b = positions.get(m.recipient);
        if (!a || !b) continue;
        const middle = a.clone().lerp(b, 0.5);
        middle.y += 25;
        const curve = new THREE.QuadraticBezierCurve3(a, middle, b);
        group.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(curve.getPoints(20)),
            new THREE.LineBasicMaterial({
              color: "#e6c989",
              transparent: true,
              opacity: 0.22,
            }),
          ),
        );
      }
    },
    dispose: clear,
  };
}
