import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createRail } from "./rail";
import * as THREE from "three";
import type { CityScene } from "./sceneSchema";
import { disasterState, type DisasterState } from "./disasterState";
import { seededRandom } from "./sceneSchema";

export function roundedRoute(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  r: number,
) {
  const p = new THREE.Path();
  p.moveTo(x1 + r, z1);
  p.lineTo(x2 - r, z1);
  p.quadraticCurveTo(x2, z1, x2, z1 + r);
  p.lineTo(x2, z2 - r);
  p.quadraticCurveTo(x2, z2, x2 - r, z2);
  p.lineTo(x1 + r, z2);
  p.quadraticCurveTo(x1, z2, x1, z2 - r);
  p.lineTo(x1, z1 + r);
  p.quadraticCurveTo(x1, z1, x1 + r, z1);
  const points = p.getSpacedPoints(240);
  return { points, length: p.getLength() };
}
export function sampleRoute(
  route: ReturnType<typeof roundedRoute>,
  distance: number,
) {
  const f = (((distance % 1) + 1) % 1) * (route.points.length - 1),
    i = Math.floor(f),
    t = f - i;
  const p = route.points[i],
    q = route.points[i + 1];
  return {
    x: THREE.MathUtils.lerp(p.x, q.x, t),
    z: THREE.MathUtils.lerp(p.y, q.y, t),
    angle: Math.atan2(q.x - p.x, q.y - p.y),
  };
}

export function createMobility(config: CityScene) {
  const group = new THREE.Group(),
    rng = seededRandom(config.seed + 91),
    half = (config.gridSize * config.blockSize) / 2;
  const routes: ReturnType<typeof roundedRoute>[] = [],
    walks: ReturnType<typeof roundedRoute>[] = [];
  for (let r = 0; r < config.gridSize; r++)
    for (let c = 0; c < config.gridSize; c++) {
      const x = -half + c * config.blockSize,
        z = -half + r * config.blockSize;
      routes.push(
        roundedRoute(
          x + 1.65,
          z + 1.65,
          x + config.blockSize - 1.65,
          z + config.blockSize - 1.65,
          2.6,
        ),
      );
      const inset = config.roadWidth / 2 + 0.75;
      walks.push(
        roundedRoute(
          x + inset,
          z + inset,
          x + config.blockSize - inset,
          z + config.blockSize - inset,
          0.6,
        ),
      );
    }
  const rail = createRail(config);
  group.add(rail.group);
  const buses = Array.from({ length: 12 }, (_, i) => ({
    route: routes[(i * 5 + config.gridSize * 5) % routes.length],
    phase: rng(),
    speed: 3.1 + rng() * 1.4,
  }));
  const cars = Array.from({ length: 96 }, (_, i) => ({
    route: routes[i % routes.length],
    phase: rng(),
    speed: 4 + rng() * 3,
  }));
  const boardwalk = roundedRoute(
    half + 53,
    -half * 0.59,
    half + 55,
    half * 0.59,
    0.8,
  );
  const people = Array.from({ length: 204 }, (_, i) => ({
    route: i >= 180 ? boardwalk : walks[i % walks.length],
    ground: i >= 180 ? 0.48 : 0,
    phase: rng(),
    speed: (0.6 + rng() * 0.65) * (i % 2 ? 1 : -1),
    height: 0.85 + rng() * 0.25,
  }));
  const dummy = new THREE.Object3D();
  function mesh(
    count: number,
    color: string,
  ): THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
    const m = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
      count,
    );
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Dynamic contact shading comes from AO; the city sun-shadow atlas stays cached.
    m.castShadow = false;
    m.frustumCulled = false;
    group.add(m);
    return m;
  }
  const bodies = mesh(cars.length, "#ffffff"),
    glass = mesh(cars.length, "#526d79"),
    wheels = mesh(cars.length * 4, "#374245"),
    lights = mesh(cars.length * 2, "#ffedbb"),
    tail = mesh(cars.length * 2, "#d5675b"),
    bumper = mesh(cars.length * 2, "#b8c2bb"),
    grille = mesh(cars.length, "#34484d"),
    windscreen = mesh(cars.length * 2, "#345d69"),
    doorline = mesh(cars.length * 2, "#cbd0c7"),
    rim = mesh(cars.length * 4, "#c9d1ca"),
    busBody = mesh(buses.length, "#ffffff"),
    busWindows = mesh(buses.length * 2, "#365e68"),
    busStripe = mesh(buses.length, "#b7d5c6"),
    busWheels = mesh(buses.length * 6, "#333d3d"),
    busLights = mesh(buses.length * 2, "#f4dfaa"),
    busPillars = mesh(buses.length * 8, "#d3dbd2"),
    busFront = mesh(buses.length, "#305461"),
    busDoors = mesh(buses.length, "#365e68"),
    busTail = mesh(buses.length * 2, "#c25c50");
  const coats = mesh(people.length, "#ffffff"),
    heads = mesh(people.length, "#cba384"),
    legs = mesh(people.length * 2, "#4d5d65"),
    arms = mesh(people.length * 2, "#cba384");
  const hazards = mesh((cars.length + buses.length) * 4, "#ffae22");
  hazards.material.emissive.set("#ff8b00");
  hazards.material.emissiveIntensity = 2;
  for (const m of [bodies, glass, busBody]) {
    m.geometry.dispose();
    m.geometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
  }
  wheels.geometry.dispose();
  wheels.geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  wheels.geometry.rotateZ(Math.PI / 2);
  busWheels.geometry.dispose();
  busWheels.geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  busWheels.geometry.rotateZ(Math.PI / 2);
  heads.geometry.dispose();
  heads.geometry = new THREE.SphereGeometry(0.5, 8, 6);
  const palette = [
    "#e4e1d4",
    "#d37f59",
    "#74a9aa",
    "#e9bb63",
    "#476d8b",
    "#a7ada1",
  ];
  cars.forEach((_, i) =>
    bodies.setColorAt(i, new THREE.Color(palette[i % palette.length])),
  );
  buses.forEach((_, i) =>
    busBody.setColorAt(
      i,
      new THREE.Color(["#e7e8dc", "#8ab0a5", "#d4bc8e", "#88a8b6"][i % 4]),
    ),
  );
  people.forEach((_, i) =>
    coats.setColorAt(
      i,
      new THREE.Color(
        ["#e0af65", "#e2d6b7", "#bc725e", "#659799", "#78896c", "#6687a1"][
          i % 6
        ],
      ),
    ),
  );
  for (const m of [lights, busLights])
    m.material.userData.nightEmission = { color: "#fff0ce", intensity: 3.4 };
  for (const m of [tail, busTail])
    m.material.userData.nightEmission = { color: "#ff3424", intensity: 2.2 };
  for (const m of [glass, windscreen, busWindows, busFront])
    m.material.userData.nightEmission = {
      color: "#ffd69a",
      intensity: m === glass || m === windscreen ? 0.1 : 0.6,
    };
  bodies.name = "cars";
  busBody.name = "buses";
  coats.name = "pedestrians";
  hazards.name = "hazards";
  const local = new THREE.Vector3();
  function set(
    m: THREE.InstancedMesh,
    i: number,
    p: { x: number; z: number; angle: number },
    ox: number,
    y: number,
    oz: number,
    w: number,
    h: number,
    d: number,
    tilt = 0,
  ) {
    local.set(ox, 0, oz).applyAxisAngle(THREE.Object3D.DEFAULT_UP, p.angle);
    dummy.position.set(p.x + local.x, y, p.z + local.z);
    dummy.rotation.set(tilt, p.angle, 0, "YXZ");
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
  }
  const assembly = new THREE.Group();
  assembly.name = "assembly-points";
  const assemblyRoutes = [...walks, boardwalk];
  const discs = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.8, 1.2, 16),
    new THREE.MeshBasicMaterial({ color: "#ffbf36", side: THREE.DoubleSide }),
    assemblyRoutes.length,
  );
  const flags = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.7, 1.4, 4),
    new THREE.MeshBasicMaterial({ color: "#ffbf36" }),
    assemblyRoutes.length,
  );
  assemblyRoutes.forEach((route, i) => {
    const p = sampleRoute(route, 0.25);
    dummy.position.set(p.x, i === walks.length ? 0.65 : 0.15, p.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    discs.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 3.8;
    dummy.rotation.set(Math.PI, 0, 0);
    dummy.updateMatrix();
    flags.setMatrixAt(i, dummy.matrix);
  });
  assembly.add(discs, flags);
  assembly.visible = false;
  group.add(assembly);
  let running = true;
  let response = disasterState(null);
  let motionTime = 0;
  const gatherings = new Map<number, number>();
  return {
    group,
    carCount: cars.length,
    busCount: buses.length,
    trainCount: rail.trainCount,
    peopleCount: people.length,
    setDisaster(state: DisasterState) {
      response = state;
      assembly.visible = state.gathering;
      if (!state.gathering) gatherings.clear();
    },
    getResponse: () => ({ ...response }),
    pedestrianPosition(cell: number) {
      const person =
        people[(cell + walks.length) % Math.min(180, people.length)];
      const p = sampleRoute(person.route, person.phase);
      return new THREE.Vector3(p.x, 1, p.z);
    },
    setRunning(v: boolean) {
      running = v;
      rail.setRunning(v);
    },
    update(dt: number, _time: number) {
      if (running) motionTime += dt;
      const time = motionTime;
      hazards.visible = response.active && Math.sin(time * 7) > 0;
      const hazard = (
        index: number,
        p: { x: number; z: number; angle: number },
        width: number,
        length: number,
      ) => {
        for (let k = 0; k < 4; k++)
          set(
            hazards,
            index * 4 + k,
            p,
            (k % 2 ? 1 : -1) * width,
            0.95,
            (k < 2 ? 1 : -1) * length,
            0.3,
            0.23,
            0.16,
          );
      };
      cars.forEach((car, i) => {
        const stopGo =
          response.active && Math.sin(time * 0.65 + (i % routes.length)) > 0.35
            ? 0
            : 1;
        if (running)
          car.phase +=
            (dt * car.speed * response.carSpeed * stopGo) / car.route.length;
        const p = sampleRoute(car.route, car.phase);
        hazard(i, p, 0.65, 1.6);
        set(bodies, i, p, 0, 0.72, 0, 1.58, 0.68, 3.1);
        for (let side = 0; side < 2; side++) {
          set(
            bumper,
            i * 2 + side,
            p,
            0,
            0.45,
            side ? 1.57 : -1.57,
            1.55,
            0.13,
            0.11,
          );
          set(
            windscreen,
            i * 2 + side,
            p,
            0,
            1.28,
            side ? 0.76 : -1.06,
            1.12,
            0.35,
            0.055,
          );
          set(
            doorline,
            i * 2 + side,
            p,
            side ? 0.8 : -0.8,
            0.91,
            -0.25,
            0.04,
            0.32,
            0.09,
          );
        }
        set(grille, i, p, 0, 0.72, 1.59, 0.82, 0.2, 0.055);
        set(glass, i, p, 0, 1.25, -0.15, 1.3, 0.6, 1.75);
        for (let k = 0; k < 4; k++)
          set(
            wheels,
            i * 4 + k,
            p,
            k % 2 ? 0.73 : -0.73,
            0.45,
            k < 2 ? -0.93 : 0.93,
            0.16,
            0.47,
            0.47,
          );
        for (let k = 0; k < 4; k++)
          set(
            rim,
            i * 4 + k,
            p,
            k % 2 ? 0.82 : -0.82,
            0.45,
            k < 2 ? -0.95 : 0.95,
            0.035,
            0.19,
            0.19,
          );
        for (let k = 0; k < 2; k++)
          set(
            tail,
            i * 2 + k,
            p,
            k ? 0.56 : -0.56,
            0.77,
            -1.56,
            0.23,
            0.15,
            0.06,
          );
        for (let k = 0; k < 2; k++)
          set(
            lights,
            i * 2 + k,
            p,
            k ? 0.48 : -0.48,
            0.8,
            1.51,
            0.3,
            0.18,
            0.04,
          );
      });
      buses.forEach((bus, i) => {
        if (running)
          bus.phase += (dt * bus.speed * response.busSpeed) / bus.route.length;
        const p = sampleRoute(bus.route, bus.phase);
        hazard(cars.length + i, p, 0.8, 2.8);
        set(busBody, i, p, 0, 1.2, 0, 1.95, 1.8, 5.5);
        for (let side = 0; side < 2; side++)
          set(
            busWindows,
            i * 2 + side,
            p,
            side ? -0.99 : 0.99,
            1.56,
            0,
            0.06,
            0.78,
            4.8,
          );
        set(busStripe, i, p, 0, 0.9, 0, 2.02, 0.18, 5.38);
        set(busFront, i, p, 0, 1.63, 2.77, 1.68, 0.78, 0.06);
        set(busDoors, i, p, 0.995, 1.15, 1.24, 0.07, 1.28, 0.9);
        for (let side = 0; side < 2; side++) {
          set(
            busTail,
            i * 2 + side,
            p,
            side ? 0.58 : -0.58,
            1,
            -2.78,
            0.28,
            0.27,
            0.06,
          );
          for (let n = 0; n < 4; n++)
            set(
              busPillars,
              i * 8 + side * 4 + n,
              p,
              side ? 1.02 : -1.02,
              1.58,
              -1.75 + n * 1.16,
              0.09,
              0.82,
              0.1,
            );
        }
        for (let k = 0; k < 6; k++)
          set(
            busWheels,
            i * 6 + k,
            p,
            k % 2 ? 0.97 : -0.97,
            0.48,
            (Math.floor(k / 2) - 1) * 1.8,
            0.2,
            0.54,
            0.54,
          );
        for (let k = 0; k < 2; k++)
          set(
            busLights,
            i * 2 + k,
            p,
            k ? 0.6 : -0.6,
            1,
            2.77,
            0.3,
            0.2,
            0.055,
          );
      });
      rail.update(dt * response.trainSpeed);
      people.forEach((person, i) => {
        let walking = running;
        if (response.gathering && Math.floor(i / walks.length) % 4 !== 0) {
          // Nearest wrapped path to a marked corner, with space between arrivals.
          if (!gatherings.has(i)) {
            const slot =
              i >= 180
                ? (i - 180) * 0.0015
                : Math.floor(i / walks.length) * 0.01;
            const target = 0.25 + slot;
            gatherings.set(i, target + Math.round(person.phase - target));
          }
          const delta = gatherings.get(i)! - person.phase;
          const step =
            (dt * Math.abs(person.speed) * response.pedestrianSpeed) /
            person.route.length;
          if (running)
            person.phase += Math.sign(delta) * Math.min(Math.abs(delta), step);
          walking = running && Math.abs(delta) > 0.003;
        } else if (running)
          person.phase +=
            (dt * person.speed * response.pedestrianSpeed) /
            person.route.length;
        const p = sampleRoute(person.route, person.phase);
        if (
          (response.gathering && Math.floor(i / walks.length) % 4 !== 0
            ? gatherings.get(i)! - person.phase
            : person.speed) < 0
        )
          p.angle += Math.PI;
        const h = person.height;
        set(
          coats,
          i,
          p,
          0,
          1.2 * h + person.ground,
          0,
          0.38,
          0.55 * h,
          0.25,
          response.active && walking ? 0.2 : 0,
        );
        set(heads, i, p, 0, 1.66 * h + person.ground, 0, 0.24, 0.28 * h, 0.24);
        for (let k = 0; k < 2; k++)
          set(
            legs,
            i * 2 + k,
            p,
            k ? 0.12 : -0.12,
            0.65 * h + person.ground,
            walking
              ? Math.sin(
                  time * 7 * response.pedestrianSpeed + i + k * Math.PI,
                ) * (response.active ? 0.24 : 0.13)
              : 0,
            0.13,
            0.5 * h,
            0.15,
            walking
              ? Math.sin(
                  time * 7 * response.pedestrianSpeed + i + k * Math.PI,
                ) * (response.active ? 0.7 : 0.2)
              : 0,
          );
        for (let k = 0; k < 2; k++) {
          const swing = walking
            ? Math.sin(time * 7 * response.pedestrianSpeed + i + k * Math.PI)
            : 0;
          set(
            arms,
            i * 2 + k,
            p,
            k ? 0.27 : -0.27,
            (response.active && !walking ? 1.55 : 1.17) * h + person.ground,
            swing * (response.active ? 0.28 : 0.1),
            0.12,
            0.45 * h,
            0.13,
            -swing * (response.active ? 0.9 : 0.25),
          );
        }
      });
      for (const m of [
        arms,
        hazards,
        bodies,
        glass,
        wheels,
        lights,
        tail,
        bumper,
        grille,
        windscreen,
        doorline,
        rim,
        busBody,
        busWindows,
        busStripe,
        busWheels,
        busLights,
        busPillars,
        busFront,
        busDoors,
        busTail,
        coats,
        heads,
        legs,
      ])
        m.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      group.removeFromParent();
    },
  };
}
