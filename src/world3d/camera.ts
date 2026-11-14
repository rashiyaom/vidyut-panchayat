import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";

export function createCamera(canvas: HTMLCanvasElement) {
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 2600);
  camera.position.set(250, 225, 285);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(35, 0, 25);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 12;
  controls.maxDistance = 1400;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = 0.18;
  controls.panSpeed = 0.8;
  controls.zoomSpeed = 0.75;
  controls.rotateSpeed = 0.55;
  controls.enablePan = true;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = false;
  const keys = new Set<string>();
  let overview = true;
  const overviewTarget = new THREE.Vector3(35, 0, 25);
  function overviewPosition() {
    return new THREE.Vector3(215, 225, 260)
      .multiplyScalar(Math.max(1, 1.35 / camera.aspect))
      .add(overviewTarget);
  }
  let flight: gsap.core.Timeline | undefined;
  function cancel() {
    flight?.kill();
    flight = undefined;
  }
  controls.addEventListener("start", () => {
    overview = false;
    cancel();
  });
  const down = (e: KeyboardEvent) => {
    if (document.querySelector("dialog[open]")) return;
    if (
      e.target instanceof HTMLElement &&
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target.tagName)
    )
      return;
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.key)
    ) {
      keys.add(e.key.toLowerCase());
      e.preventDefault();
    }
  };
  const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  const blur = () => keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  function focus(target: THREE.Vector3, distance = 110, duration = 1.3) {
    overview = false;
    cancel();
    const offset = camera.position
      .clone()
      .sub(controls.target)
      .normalize()
      .multiplyScalar(distance);
    offset.y = Math.max(offset.y, distance * 0.45);
    const to = target.clone().add(offset);
    flight = gsap
      .timeline({
        onComplete: () => {
          flight = undefined;
        },
      })
      .to(
        controls.target,
        {
          x: target.x,
          y: target.y,
          z: target.z,
          duration,
          ease: "power2.inOut",
        },
        0,
      )
      .to(
        camera.position,
        { x: to.x, y: to.y, z: to.z, duration, ease: "power2.inOut" },
        0,
      );
  }
  return {
    camera,
    controls,
    focus,
    reset() {
      cancel();
      overview = true;
      const position = overviewPosition();
      flight = gsap
        .timeline()
        .to(controls.target, { x: 35, y: 0, z: 25, duration: 1.4 }, 0)
        .to(
          camera.position,
          { x: position.x, y: position.y, z: position.z, duration: 1.4 },
          0,
        );
    },
    resize(aspect: number) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      if (overview) {
        cancel();
        controls.target.copy(overviewTarget);
        camera.position.copy(overviewPosition());
      }
    },
    zoom(factor: number) {
      overview = false;
      cancel();
      camera.position
        .sub(controls.target)
        .multiplyScalar(factor)
        .add(controls.target);
      controls.update();
    },
    rotate() {
      overview = false;
      cancel();
      const v = camera.position
        .clone()
        .sub(controls.target)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)
        .add(controls.target);
      flight = gsap
        .timeline()
        .to(camera.position, { x: v.x, y: v.y, z: v.z, duration: 0.6 });
    },
    update(dt: number) {
      if (keys.size) {
        overview = false;
        cancel();
        const forward = controls.target.clone().sub(camera.position);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(
          forward,
          new THREE.Vector3(0, 1, 0),
        );
        const delta = new THREE.Vector3();
        if (keys.has("w") || keys.has("arrowup")) delta.add(forward);
        if (keys.has("s") || keys.has("arrowdown")) delta.sub(forward);
        if (keys.has("d") || keys.has("arrowright")) delta.add(right);
        if (keys.has("a") || keys.has("arrowleft")) delta.sub(right);
        delta.multiplyScalar(
          dt * camera.position.distanceTo(controls.target) * 0.5,
        );
        controls.target.add(delta);
        camera.position.add(delta);
      }
      controls.update();
      const x = THREE.MathUtils.clamp(controls.target.x, -160, 215),
        z = THREE.MathUtils.clamp(controls.target.z, -160, 160);
      camera.position.x += x - controls.target.x;
      camera.position.z += z - controls.target.z;
      controls.target.x = x;
      controls.target.z = z;
    },
    dispose() {
      cancel();
      controls.dispose();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    },
  };
}
