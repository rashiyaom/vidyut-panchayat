import * as THREE from "three";
export function flowParticle(from: THREE.Vector3, to: THREE.Vector3) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 6, 4),
    new THREE.MeshBasicMaterial({ color: "#b4ffe3" }),
  );
  return {
    mesh,
    update(time: number, utilization: number) {
      mesh.visible = utilization > 0;
      mesh.position.lerpVectors(
        from,
        to,
        (time * (0.1 + utilization * 0.4)) % 1,
      );
    },
  };
}
