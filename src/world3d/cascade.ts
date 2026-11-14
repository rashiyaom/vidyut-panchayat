import * as THREE from "three";
export function cascadeRing(position: THREE.Vector3) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(8, 8.5, 32),
    new THREE.MeshBasicMaterial({
      color: "#ff9b7e",
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position);
  mesh.position.y = 0.8;
  let stress = 0;
  return {
    mesh,
    set(value: number) {
      stress = value;
    },
    update(time: number) {
      const phase = (time * 0.35) % 1;
      mesh.visible = stress > 0.05;
      mesh.scale.setScalar(1 + phase * 2);
      mesh.material.opacity = Math.min(0.55, stress) * (1 - phase);
    },
  };
}
