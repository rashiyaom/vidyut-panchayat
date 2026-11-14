import * as THREE from "three";
import { CityBatch, lamp } from "./primitives";
import { seededRandom, type CityScene } from "./sceneSchema";
import type { createCity } from "./city";
import type { createRendering } from "./rendering";

export type LightingMode = "day" | "night" | "golden";
export const lightingModes: LightingMode[] = ["day", "night", "golden"];

/** Instanced light pools and emissive fixtures provide city-wide coverage without hundreds of shadow lights. */
export function createNightLighting(
  config: CityScene,
  city: ReturnType<typeof createCity>,
  mobility: THREE.Group,
  scene: THREE.Scene,
  sun: THREE.DirectionalLight,
  hemi: THREE.HemisphereLight,
  renderer: THREE.WebGLRenderer,
  rendering: ReturnType<typeof createRendering>,
) {
  let mode: LightingMode = "day",
    amount = 0;
  const group = new THREE.Group();
  group.name = "Nagar night lighting";
  const half = (config.gridSize * config.blockSize) / 2;
  const fixtures = new CityBatch();
  // Promenades, bridge crossings and beach paths each have a continuous lighting rhythm.
  for (let z = -half + 5; z < half; z += 12)
    lamp(fixtures, half + 8, z, Math.PI);
  for (let z = -half * 0.72; z < half * 0.72; z += 10) {
    lamp(fixtures, half + 51, z, 0);
    lamp(fixtures, half + 72, z, Math.PI);
  }
  for (const z of [-config.blockSize * 2, config.blockSize * 2])
    for (let x = half + 12; x < half + 60; x += 10) {
      for (const side of [-1, 1]) {
        fixtures.cylinder(x, 2.7, z + side * 2.5, 0.065, 2.8, "#576a6c");
        fixtures.sphere(
          x,
          4.15,
          z + side * 2.5,
          0.16,
          0.18,
          0.16,
          "#ffe2ac",
          "lamp",
        );
      }
    }
  for (const entity of city.entities) {
    fixtures.setTransform(
      entity.position.x,
      entity.position.z,
      entity.rotation,
      entity.scale,
    );
    // Each city service and park has a readable entrance at night.
    if (entity.facility || entity.category === "Public park") {
      lamp(fixtures, -6, 7);
      lamp(fixtures, 6, 7, Math.PI);
    }
  }
  fixtures.setTransform(0, 0);
  const extra = fixtures.finish();
  group.add(extra);
  scene.add(group);

  const nightUniforms: { value: number }[] = [];
  const emissionMaterials = new Map<
    THREE.MeshStandardMaterial,
    { color: THREE.Color; intensity: number }
  >();
  const anchors: { position: THREE.Vector3; color: THREE.Color }[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  for (const root of [city.group, mobility, extra]) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      for (const anchor of o.userData.lightAnchors ?? []) {
        const position = anchor.position.clone().applyMatrix4(o.matrixWorld);
        if (position.y > 2 && position.y < 7)
          anchors.push({ position, color: anchor.color });
      }
      if (
        o instanceof THREE.InstancedMesh &&
        ["cars", "buses", "trains"].includes(o.name)
      )
        meshes.push(o);
      if (!(o instanceof THREE.Mesh)) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const material of materials) {
        if (
          material.userData.nightUniform &&
          !nightUniforms.includes(material.userData.nightUniform)
        )
          nightUniforms.push(material.userData.nightUniform);
        if (
          material instanceof THREE.MeshStandardMaterial &&
          material.userData.nightEmission
        ) {
          emissionMaterials.set(material, {
            color: new THREE.Color(material.userData.nightEmission.color),
            intensity: material.userData.nightEmission.intensity,
          });
        }
      }
    });
  }
  const glowMaterial = (beam: boolean) =>
    new THREE.ShaderMaterial({
      uniforms: { brightness: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; varying vec3 vTint;
      void main(){vUv=uv; vTint=instanceColor; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float brightness; varying vec2 vUv; varying vec3 vTint;
      void main(){ vec2 q=vUv-.5;
        float alpha=${beam ? "pow(max(0.,1.-abs(q.x)*2./(.35+.65*vUv.y)),2.)*sin(vUv.y*3.14159)" : "pow(max(0.,1.-length(q)*2.),2.2)"};
        gl_FragColor=vec4(vTint*${beam ? "1.4" : ".9"},alpha*brightness);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
  const pools = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    glowMaterial(false),
    anchors.length,
  );
  pools.name = "Street and beach light pools";
  const dummy = new THREE.Object3D();
  anchors.forEach((a, i) => {
    const bridge =
      a.position.x > half + 10 &&
      a.position.x < half + 60 &&
      Math.abs(Math.abs(a.position.z) - config.blockSize * 2) < 4;
    const beach = a.position.x > half + 40;
    dummy.position.set(
      a.position.x,
      bridge ? 1.34 : beach ? 0.77 : 0.43,
      a.position.z,
    );
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(13, 13, 1);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
    pools.setColorAt(i, a.color);
  });
  pools.frustumCulled = false;
  pools.renderOrder = 1;
  group.add(pools);
  const headlightCount = meshes.reduce(
    (sum, m) => sum + (m.name === "trains" ? Math.ceil(m.count / 3) : m.count),
    0,
  );
  const headlights = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    glowMaterial(true),
    headlightCount,
  );
  headlights.name = "Moving headlight pools";
  headlights.frustumCulled = false;
  headlights.renderOrder = 2;
  headlights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < headlightCount; i++)
    headlights.setColorAt(i, new THREE.Color("#fff1cc"));
  group.add(headlights);
  const pointLights: THREE.PointLight[] = [];
  for (const [x, y, z, color, intensity, range] of [
    [14, 12, 14, "#ffca84", 100, 65],
    [-65, 8, 45, "#ffc581", 55, 55],
    [half + 65, 7, -26, "#ffd08c", 18, 35],
    [half + 65, 7, 28, "#ffd08c", 18, 35],
    [half + 68, 17, 0, "#8bbfc7", 28, 42],
    [65, 9, -65, "#b1c9ff", 55, 55],
  ] as const) {
    const light = new THREE.PointLight(color, 0, range, 1.5);
    light.position.set(x, y, z);
    light.userData.peak = intensity;
    group.add(light);
    pointLights.push(light);
  }
  // Small, static stars give the horizon depth without competing with the city lights.
  const rng = seededRandom(8031),
    positions: number[] = [];
  for (let i = 0; i < 500; i++) {
    const az = rng() * Math.PI * 2,
      elevation = 0.2 + rng() * 1.2;
    positions.push(
      Math.cos(az) * Math.cos(elevation) * 850,
      Math.sin(elevation) * 850,
      Math.sin(az) * Math.cos(elevation) * 850,
    );
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    ),
    new THREE.PointsMaterial({
      color: "#d8e7ff",
      size: 1.3,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    }),
  );
  group.add(stars);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(7, 24, 16),
    new THREE.MeshBasicMaterial({
      color: "#e9ecdf",
      transparent: true,
      opacity: 0,
      fog: false,
    }),
  );
  moon.position.set(-240, 210, -390);
  group.add(moon);
  const groundRotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI / 2,
  );
  const matrix = new THREE.Matrix4(),
    position = new THREE.Vector3(),
    rotation = new THREE.Quaternion(),
    scale = new THREE.Vector3(),
    forward = new THREE.Vector3();
  const daySky = new THREE.Color(),
    sky = new THREE.Color(),
    moonSky = new THREE.Color("#0b1429"),
    stormSky = new THREE.Color();
  return {
    setMode(next: LightingMode) {
      mode = next;
      renderer.shadowMap.needsUpdate = true;
    },
    update(dt: number, rain = 0) {
      amount = THREE.MathUtils.damp(amount, mode === "night" ? 1 : 0, 2.2, dt);
      const golden = mode === "golden";
      daySky.set(golden ? "#ddd1ba" : "#c8dcde");
      sky.copy(daySky).lerp(moonSky, amount);
      stormSky.set(amount > 0.5 ? "#111e31" : "#657e8b");
      sky.lerp(stormSky, rain * 0.75);
      (scene.background as THREE.Color).copy(sky);
      const fog = scene.fog as THREE.FogExp2;
      fog.color.copy(sky);
      fog.density = 0.00025 + amount * 0.00022 + rain * 0.0018;
      sun.color
        .set(golden ? "#ffbf80" : "#fff0d2")
        .lerp(new THREE.Color("#b7cfff"), amount);
      sun.position.set(golden ? -160 : -80, golden ? 95 : 170, 80);
      sun.intensity =
        THREE.MathUtils.lerp(2.6, 0.22, amount) * (1 - rain * 0.65);
      hemi.color.set("#dcecf0").lerp(new THREE.Color("#6f91c0"), amount);
      hemi.groundColor.set("#b8a885").lerp(new THREE.Color("#26344c"), amount);
      hemi.intensity =
        THREE.MathUtils.lerp(golden ? 0.65 : 0.85, 0.36, amount) *
        (1 - rain * 0.2);
      scene.environmentIntensity = THREE.MathUtils.lerp(0.35, 0.12, amount);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.92, 0.95, amount);
      city.water.material.uniforms.nightAmount.value = amount;
      rendering.setNight(amount);
      for (const uniform of nightUniforms) uniform.value = amount;
      for (const [material, emission] of emissionMaterials) {
        material.emissive.copy(emission.color);
        material.emissiveIntensity = emission.intensity * amount;
      }
      pools.visible = headlights.visible = amount > 0.005;
      pools.material.uniforms.brightness.value = amount * 0.36;
      headlights.material.uniforms.brightness.value = amount * 0.45;
      stars.material.opacity = amount * 0.6;
      moon.material.opacity = amount;
      for (const light of pointLights)
        light.intensity = light.userData.peak * amount;
      if (amount < 0.005) return;
      let index = 0;
      for (const mesh of meshes)
        for (let i = 0; i < mesh.count; i += mesh.name === "trains" ? 3 : 1) {
          mesh.getMatrixAt(i, matrix);
          matrix.decompose(position, rotation, scale);
          forward.set(0, 0, 1).applyQuaternion(rotation);
          const train = mesh.name === "trains";
          dummy.position.copy(position).addScaledVector(forward, train ? 8 : 5);
          dummy.position.y = train ? 10.96 : 0.235;
          dummy.quaternion.copy(rotation).multiply(groundRotation);
          dummy.scale.set(train ? 4 : 3.8, train ? 12 : 8, 1);
          dummy.updateMatrix();
          headlights.setMatrixAt(index++, dummy.matrix);
        }
      headlights.instanceMatrix.needsUpdate = true;
    },
    stats: () => ({
      mode,
      amount,
      streetLights: anchors.length,
      movingLights: headlightCount,
      windowMaterials: nightUniforms.length,
    }),
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
        }
      });
      group.removeFromParent();
    },
  };
}
