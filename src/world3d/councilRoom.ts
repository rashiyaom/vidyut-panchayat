import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Profile, AgentId } from "../contract/types";
const palette = [
  "#2b7071",
  "#a75d45",
  "#344f71",
  "#c99755",
  "#64527a",
  "#7f354a",
  "#416557",
  "#d3bd8a",
  "#687d91",
  "#a8666b",
];
export function createCouncilRoom(
  canvas: HTMLCanvasElement,
  profiles: Profile[],
  select: (id: AgentId) => void,
) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const scene = new T.Scene();
  scene.background = new T.Color("#a4aaa2");
  scene.fog = new T.Fog("#a4aaa2", 28, 65);
  const camera = new T.PerspectiveCamera(43, 1, 0.1, 100);
  camera.position.set(1, 11.8, 18.8);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.7, 0);
  controls.enableDamping = true;
  controls.minDistance = 9;
  controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = 0.05;
  controls.enablePan = false;
  scene.add(new T.HemisphereLight("#e8f1ee", "#343a32", 1.5));
  const pmrem = new T.PMREMGenerator(renderer),
    environment = new RoomEnvironment(),
    environmentTarget = pmrem.fromScene(environment, 0.04);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.35;
  environment.dispose();
  pmrem.dispose();
  const fill = new T.DirectionalLight("#d7e8f0", 1.8);
  fill.position.set(12, 8, -3);
  scene.add(fill);
  const sun = new T.DirectionalLight("#ffe7c0", 2.2);
  sun.position.set(-8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -14,
    right: 14,
    top: 14,
    bottom: -14,
  });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const materials: T.Material[] = [],
    textures: T.Texture[] = [];
  function material(color: string, roughness = 0.7) {
    const m = new T.MeshStandardMaterial({ color, roughness });
    materials.push(m);
    return m;
  }
  function shape(
    parent: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(
    p: T.Object3D,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    return shape(
      p,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.045, w / 5, h / 5, d / 5)),
      m,
      x,
      y,
      z,
    );
  }
  function ellipsoid(
    p: T.Object3D,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    const o = shape(p, new T.SphereGeometry(1, 20, 16), m, x, y, z);
    o.scale.set(w, h, d);
    return o;
  }
  function limb(
    p: T.Object3D,
    m: T.Material,
    a: number[],
    b: number[],
    r: number,
  ) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b);
    const o = shape(
      p,
      new T.CapsuleGeometry(r, start.distanceTo(end), 6, 12),
      m,
      ...(start.clone().add(end).multiplyScalar(0.5).toArray() as [
        number,
        number,
        number,
      ]),
    );
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      end.sub(start).normalize(),
    );
    return o;
  }
  const wood = material("#513a2c", 0.4),
    edge = material("#bc9859", 0.35),
    floor = material("#aaa79c"),
    cream = material("#eee4d3"),
    dark = material("#252c30"),
    leather = material("#354d47", 0.65);
  shape(scene, new T.CylinderGeometry(17, 17, 0.3, 96), floor, 0, -0.15, 0);
  const rug = material("#425650");
  shape(scene, new T.CylinderGeometry(8.9, 8.9, 0.035, 96), rug, 0, 0.025, 0);
  for (const radius of [8.45, 8.65])
    shape(
      scene,
      new T.TorusGeometry(radius, 0.018, 6, 96),
      edge,
      0,
      0.05,
      0,
    ).rotation.x = Math.PI / 2;
  // Walnut acoustic slats and inset teal panels, with open-front daylight.
  box(scene, material("#253e38"), 0, 3.4, -11.4, 27, 6.8, 0.4);
  for (let i = -34; i <= 34; i++)
    if (Math.abs(i) > 12)
      box(scene, wood, i * 0.37, 3.4, -11.12, 0.13, 6.6, 0.15);
  for (const x of [-12, 12]) {
    box(scene, cream, x, 2.8, 0, 0.3, 5.6, 23);
    for (let z = -8; z < 9; z += 4) {
      box(scene, material("#c1d5d2"), x * 0.989, 3, z, 0.06, 4.8, 3.45);
      box(scene, dark, x * 0.98, 3, z, 0.08, 4.8, 0.07);
    }
    for (const z of [-9, 8]) {
      const pot = material("#665949");
      shape(
        scene,
        new T.CylinderGeometry(0.48, 0.35, 0.8, 20),
        pot,
        x * 0.82,
        0.4,
        z,
      );
      for (let j = 0; j < 8; j++) {
        const a = j * 2.4;
        const leaf = ellipsoid(
          scene,
          material(j % 2 ? "#39554b" : "#537466"),
          x * 0.82 + Math.sin(a) * 0.38,
          1.4 + j * 0.09,
          z + Math.cos(a) * 0.38,
          0.17,
          0.7,
          0.1,
        );
        leaf.rotation.z = Math.sin(a) * 0.55;
      }
    }
  }
  for (const x of [-6, 6]) {
    const lightMat = new T.MeshStandardMaterial({
      color: "#ffe0a6",
      emissive: "#ffcb72",
      emissiveIntensity: 2,
    });
    materials.push(lightMat);
    box(scene, lightMat, x, 3.2, -11.04, 0.055, 2.2, 0.06);
  }
  function label(
    text: string,
    width = 1024,
    height = 180,
    bg = "#f3e5c8",
    fg = "#403426",
  ) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(height * 0.44)}px Georgia`;
    ctx.fillText(text, width / 2, height / 2, width * 0.92);
    const texture = new T.CanvasTexture(c);
    texture.colorSpace = T.SRGBColorSpace;
    textures.push(texture);
    const m = new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide });
    materials.push(m);
    return m;
  }
  shape(
    scene,
    new T.PlaneGeometry(12, 1.6),
    label("N A G A R   /   P A N C H A Y A T", 1400, 180, "#253e38", "#cfb88b"),
    0,
    4,
    -11.04,
  );
  const table = shape(
    scene,
    new T.CylinderGeometry(5.9, 5.9, 0.28, 96),
    wood,
    0,
    1.85,
    0,
  );
  shape(
    scene,
    new T.TorusGeometry(5.88, 0.045, 8, 96),
    edge,
    0,
    2.01,
    0,
  ).rotation.x = Math.PI / 2;
  shape(scene, new T.CylinderGeometry(3.65, 3.65, 0.06, 96), dark, 0, 2.03, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    box(scene, wood, Math.sin(a) * 3, 1, Math.cos(a) * 3, 0.3, 1.8, 0.3);
  }
  const center = shape(
    scene,
    new T.PlaneGeometry(4.7, 1.1),
    label("THE CITY WE SHARE", 1024, 180, "#252c30", "#b6c6b9"),
    0,
    2.12,
    2.55,
  );
  center.rotation.x = -Math.PI / 2;
  // A miniature civic skyline on the table; decisions remain engine-owned.
  for (let i = 0; i < 13; i++) {
    const a = i * 2.4,
      r = 0.4 + (i % 3) * 0.45;
    box(
      scene,
      material(i % 2 ? "#527b78" : "#819996"),
      Math.sin(a) * r,
      2.3 + (i % 4) * 0.09,
      Math.cos(a) * r,
      0.23,
      0.4 + (i % 4) * 0.18,
      0.25,
    );
  }
  const seats: {
    id: AgentId;
    group: T.Group;
    head: T.Group;
    hand: T.Mesh;
    gesture: T.Group;
    mouth: T.Mesh;
    anchor: T.Vector3;
    ring: T.Mesh;
  }[] = [];
  profiles.forEach((p, i) => {
    const a = (i * Math.PI * 2) / 10,
      group = new T.Group();
    group.position.set(Math.sin(a) * 6.8, 0, Math.cos(a) * 6.8);
    group.rotation.y = a + Math.PI;
    group.userData.agent = p.id;
    scene.add(group);
    const cloth = material(palette[i]),
      skin = material(
        ["#b57b56", "#9b6142", "#cf9671", "#7c4d35", "#bd8662"][i % 5],
      ),
      hair = material(i === 6 ? "#6d6259" : "#25211e"),
      shoe = material("#302b29"),
      gold = material("#cfae58", 0.3);
    box(group, leather, 0, 0.9, 0, 1.1, 0.23, 0.95);
    box(group, leather, 0, 1.65, -0.43, 1.1, 1.5, 0.16);
    for (const x of [-0.43, 0.43])
      for (const z of [-0.35, 0.35])
        box(group, dark, x, 0.45, z, 0.07, 0.9, 0.07);
    const woman = [0, 3, 5, 8].includes(i),
      kurta = [2, 4, 6, 9].includes(i);
    // Seated human anatomy: lap, bent legs, torso, neck and individually modelled faces.
    limb(
      group,
      woman ? cloth : dark,
      [-0.24, 0.92, 0.05],
      [-0.26, 0.92, 0.7],
      0.2,
    );
    limb(
      group,
      woman ? cloth : dark,
      [0.24, 0.92, 0.05],
      [0.26, 0.92, 0.7],
      0.2,
    );
    for (const x of [-0.26, 0.26]) {
      limb(group, woman ? cloth : dark, [x, 0.9, 0.7], [x, 0.25, 0.73], 0.14);
      ellipsoid(group, shoe, x, 0.15, 0.88, 0.19, 0.12, 0.32);
    }
    const torso = shape(
      group,
      new T.CylinderGeometry(0.39, 0.46, 1.1, 24),
      cloth,
      0,
      1.62,
      0,
    );
    torso.scale.z = 0.65;
    if (woman) {
      const drape = box(
        group,
        material(i === 0 ? "#cfb168" : "#dfb98c"),
        -0.13,
        1.65,
        0.29,
        0.24,
        1.12,
        0.045,
      );
      drape.rotation.z = -0.38;
      box(group, cloth, 0, 1, 0.45, 0.86, 0.16, 0.85);
      for (let j = 0; j < 5; j++)
        box(group, gold, -0.3 + j * 0.15, 0.92, 0.87, 0.012, 0.13, 0.03);
    } else {
      const collar = box(group, cream, 0, 2.12, 0.16, 0.25, 0.14, 0.17);
      collar.rotation.z = 0.05;
      for (let j = 0; j < 5; j++)
        ellipsoid(group, dark, 0, 2 - j * 0.15, 0.278, 0.018, 0.018, 0.012);
      if (!kurta) {
        const tie = box(
          group,
          material("#7b3432"),
          0,
          1.8,
          0.29,
          0.1,
          0.5,
          0.035,
        );
        tie.rotation.z = 0.06;
      } else box(group, cloth, 0, 1.05, 0.17, 0.79, 0.28, 0.52);
    }
    shape(group, new T.CylinderGeometry(0.13, 0.15, 0.22, 16), skin, 0, 2.2, 0);
    const head = new T.Group();
    head.position.y = 2.53;
    group.add(head);
    ellipsoid(head, skin, 0, 0, 0, 0.28, 0.36, 0.26);
    ellipsoid(head, hair, 0, 0.18, -0.035, 0.285, 0.21, 0.255);
    if (woman) ellipsoid(head, hair, 0, 0.08, -0.25, 0.2, 0.23, 0.17);
    for (const x of [-0.29, 0.29]) {
      ellipsoid(head, skin, x, -0.015, 0, 0.06, 0.095, 0.055);
      if (woman)
        shape(
          head,
          new T.TorusGeometry(0.04, 0.009, 6, 12),
          gold,
          x,
          -0.13,
          0.02,
        );
    }
    for (const x of [-0.105, 0.105]) {
      ellipsoid(head, cream, x, 0.03, 0.237, 0.065, 0.034, 0.018);
      ellipsoid(head, dark, x, 0.03, 0.253, 0.025, 0.027, 0.012);
      box(head, hair, x, 0.09, 0.23, 0.115, 0.018, 0.025);
    }
    ellipsoid(head, skin, 0, -0.035, 0.26, 0.052, 0.085, 0.065);
    const mouth = ellipsoid(
      head,
      material("#633b32"),
      0,
      -0.16,
      0.227,
      0.07,
      0.012,
      0.015,
    );
    if (woman)
      ellipsoid(head, material("#ab3c31"), 0, 0.14, 0.245, 0.018, 0.021, 0.01);
    if (i === 1 || i === 6)
      box(head, hair, 0, -0.11, 0.255, 0.15, 0.025, 0.022);
    limb(group, cloth, [-0.39, 2, 0], [-0.58, 1.55, 0.38], 0.14);
    limb(group, skin, [-0.58, 1.55, 0.38], [-0.4, 1.98, 1.05], 0.105);
    ellipsoid(group, skin, -0.4, 2, 1.1, 0.12, 0.06, 0.18);
    limb(group, cloth, [0.39, 2, 0], [0.58, 1.57, 0.37], 0.14);
    const forearm = limb(
      group,
      skin,
      [0.58, 1.57, 0.37],
      [0.38, 2, 1.02],
      0.105,
    );
    const hand = ellipsoid(group, skin, 0.38, 2, 1.1, 0.12, 0.06, 0.18);
    const gesture = new T.Group();
    gesture.position.set(0.58, 1.57, 0.37);
    group.add(gesture);
    group.updateMatrixWorld(true);
    gesture.attach(forearm);
    gesture.attach(hand);
    const card = shape(
      group,
      new T.PlaneGeometry(1.55, 0.38),
      label(`${p.label} AI`, 768, 150),
      0,
      2.08,
      1.72,
    );
    card.rotation.x = -Math.PI / 2;
    box(group, edge, 0, 2.025, 1.72, 1.6, 0.035, 0.43);
    box(group, cream, -0.6, 2.02, 1.5, 0.4, 0.025, 0.6);
    box(group, dark, 0.65, 2.03, 1.4, 0.32, 0.035, 0.47);
    shape(
      group,
      new T.CylinderGeometry(0.09, 0.08, 0.22, 16),
      cream,
      0.7,
      2.13,
      1.9,
    );
    limb(group, dark, [0.5, 2.02, 1.9], [0.45, 2.35, 1.65], 0.016);
    ellipsoid(group, dark, 0.45, 2.35, 1.65, 0.035, 0.055, 0.035);
    const ring = shape(
      scene,
      new T.TorusGeometry(0.68, 0.035, 8, 32),
      material("#d9ad61"),
      group.position.x,
      0.06,
      group.position.z,
    );
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    seats.push({
      id: p.id,
      group,
      head,
      hand,
      gesture,
      mouth,
      anchor: new T.Vector3(group.position.x, 3.2, group.position.z),
      ring,
    });
  });
  const raycaster = new T.Raycaster(),
    pointer = new T.Vector2();
  let down = [0, 0];
  const onDown = (e: PointerEvent) => {
    down = [e.clientX, e.clientY];
  };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObjects(
      seats.map((s) => s.group),
      true,
    )) {
      let o: T.Object3D | null = hit.object;
      while (o && !o.userData.agent) o = o.parent;
      if (o?.userData.agent) {
        select(o.userData.agent);
        break;
      }
    }
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  return {
    seats,
    camera,
    render(time: number, speaker?: string, selected?: string) {
      const r = canvas.getBoundingClientRect();
      if (
        canvas.width !== Math.round(r.width * renderer.getPixelRatio()) ||
        canvas.height !== Math.round(r.height * renderer.getPixelRatio())
      ) {
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
      }
      controls.update();
      for (const s of seats) {
        const active = s.id === speaker;
        const amount = active ? 1 : 0;
        s.head.rotation.x = T.MathUtils.lerp(
          s.head.rotation.x,
          active ? Math.sin(time * 2.7) * 0.035 : 0,
          0.12,
        );
        s.head.rotation.y = T.MathUtils.lerp(
          s.head.rotation.y,
          active
            ? Math.sin(time * 0.7) * 0.13
            : speaker
              ? Math.sin(
                  seats.findIndex((x) => x.id === speaker) - seats.indexOf(s),
                ) * 0.2
              : 0,
          0.06,
        );
        s.gesture.rotation.x = T.MathUtils.lerp(
          s.gesture.rotation.x,
          -amount * (0.16 + Math.sin(time * 1.8) * 0.13),
          0.1,
        );
        s.gesture.rotation.z = T.MathUtils.lerp(
          s.gesture.rotation.z,
          amount * Math.sin(time * 1.1) * 0.12,
          0.1,
        );
        s.mouth.scale.y =
          0.012 + (active ? (0.5 + 0.5 * Math.sin(time * 13)) * 0.035 : 0);
        s.ring.visible = active || s.id === selected;
      }
      renderer.render(scene, camera);
    },
    top() {
      camera.position.set(0, 23, 0.01);
      controls.target.set(0, 1.7, 0);
    },
    overview() {
      camera.position.set(1, 11.8, 18.8);
      controls.target.set(0, 1.7, 0);
    },
    dispose() {
      controls.dispose();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      environmentTarget.dispose();
      renderer.dispose();
    },
    table,
  };
}
