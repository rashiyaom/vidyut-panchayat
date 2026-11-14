import * as THREE from "three";

type Primitive = "box" | "cylinder" | "cone" | "sphere" | "roof" | "leaf";
type Instance = { matrix: THREE.Matrix4; color: THREE.Color; owner?: string };

/** Collects repeated details into shared draw calls, including all windows and foliage. */
export class CityBatch {
  readonly group = new THREE.Group();
  private buckets = new Map<string, Instance[]>();
  private transform = new THREE.Matrix4();
  private dummy = new THREE.Object3D();
  private owner: string | undefined;
  private bindings = new Map<
    string,
    { mesh: THREE.InstancedMesh; index: number; color: THREE.Color }[]
  >();
  private levels = new Map<string, number>();
  setOwner(id?: string) {
    this.owner = id;
  }
  setService(id: string, service: number) {
    const level = Math.max(0, Math.min(1, service));
    if (this.levels.get(id) === level) return;
    this.levels.set(id, level);
    for (const binding of this.bindings.get(id) ?? []) {
      binding.mesh.setColorAt(
        binding.index,
        binding.color.clone().multiplyScalar(0.25 + 0.75 * level),
      );
      binding.mesh.instanceColor!.needsUpdate = true;
    }
  }
  setTransform(x: number, z: number, rotation = 0, scale = 1) {
    this.transform.compose(
      new THREE.Vector3(x, 0, z),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        rotation,
      ),
      new THREE.Vector3(scale, scale, scale),
    );
  }
  add(
    kind: Primitive,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    rotation = 0,
    surface = "matte",
  ) {
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(0, rotation, 0);
    this.dummy.scale.set(w, h, d);
    this.dummy.updateMatrix();
    const key = kind + ":" + surface;
    const items = this.buckets.get(key) ?? [];
    items.push({
      matrix: new THREE.Matrix4().multiplyMatrices(
        this.transform,
        this.dummy.matrix,
      ),
      color: new THREE.Color(color),
      owner: this.owner,
    });
    this.buckets.set(key, items);
  }
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: string,
    r = 0,
    s = "matte",
  ) {
    this.add("box", x, y, z, w, h, d, c, r, s);
  }
  cylinder(x: number, y: number, z: number, r: number, h: number, c: string) {
    this.add("cylinder", x, y, z, r, h, r, c);
  }
  cone(x: number, y: number, z: number, r: number, h: number, c: string) {
    this.add("cone", x, y, z, r, h, r, c);
  }
  sphere(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: string,
  ) {
    this.add("sphere", x, y, z, w, h, d, c);
  }
  /** A beam between arbitrary points, in the current lot's local coordinates. */
  beam(
    from: [number, number, number],
    to: [number, number, number],
    radius: number,
    color: string,
  ) {
    const a = new THREE.Vector3(...from),
      end = new THREE.Vector3(...to);
    this.dummy.position.copy(a).add(end).multiplyScalar(0.5);
    this.dummy.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(a).normalize(),
    );
    this.dummy.scale.set(radius, a.distanceTo(end), radius);
    this.dummy.updateMatrix();
    const key = "cylinder:matte",
      items = this.buckets.get(key) ?? [];
    items.push({
      matrix: new THREE.Matrix4().multiplyMatrices(
        this.transform,
        this.dummy.matrix,
      ),
      color: new THREE.Color(color),
      owner: this.owner,
    });
    this.buckets.set(key, items);
  }
  finish() {
    const roof = new THREE.BufferGeometry();
    const vertices = [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0, 0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0, 0.5, 0.5],
    ];
    const indices = [
      0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3,
    ];
    roof.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        indices.flatMap((i) => vertices[i]),
        3,
      ),
    );
    roof.computeVertexNormals();
    const leaf = new THREE.BufferGeometry(),
      leafVertices: number[] = [];
    for (let i = 0; i < 8; i++) {
      const point = (t: number, side: number) => [
        t,
        Math.sin(t * Math.PI) * 0.18 - t * t * 0.22,
        side * Math.sin(t * Math.PI) * 0.12,
      ];
      const a = i / 8,
        e = (i + 1) / 8;
      leafVertices.push(
        ...point(a, -1),
        ...point(e, -1),
        ...point(a, 1),
        ...point(a, 1),
        ...point(e, -1),
        ...point(e, 1),
      );
    }
    leaf.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(leafVertices, 3),
    );
    leaf.computeVertexNormals();
    const geometries = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 24),
      cone: new THREE.ConeGeometry(1, 1, 8),
      sphere: new THREE.IcosahedronGeometry(1, 1),
      roof,
      leaf,
    };
    for (const [key, items] of this.buckets) {
      const [kind, surface] = key.split(":");
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: surface === "glass" ? 0.18 : 0.88,
        metalness: surface === "glass" ? 0.52 : 0,
        side: kind === "leaf" ? THREE.DoubleSide : THREE.FrontSide,
      });
      // Subtle physical-scale surface grain; shared shader, no image requests.
      if (surface !== "glass")
        material.onBeforeCompile = (shader) => {
          shader.vertexShader =
            "varying vec3 vSurfacePosition;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <project_vertex>",
            `
          vec4 surfacePosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            surfacePosition = instanceMatrix * surfacePosition;
          #endif
          vSurfacePosition = (modelMatrix * surfacePosition).xyz;
          #include <project_vertex>`,
          );
          shader.fragmentShader =
            "varying vec3 vSurfacePosition;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `
          #include <color_fragment>
          float grain = fract(sin(dot(floor(vSurfacePosition * 36.0),vec3(12.9898,78.233,37.719))) * 43758.5453);
          float detailFade = 1.0-smoothstep(.02,.12,length(fwidth(vSurfacePosition)));
          diffuseColor.rgb *= 1.0+(grain-.5)*.045*detailFade;`,
          );
        };
      const mesh = new THREE.InstancedMesh(
        geometries[kind as Primitive],
        material,
        items.length,
      );
      items.forEach((v, i) => {
        mesh.setMatrixAt(i, v.matrix);
        mesh.setColorAt(i, v.color);
        if (v.owner) {
          const bindings = this.bindings.get(v.owner) ?? [];
          bindings.push({ mesh, index: i, color: v.color.clone() });
          this.bindings.set(v.owner, bindings);
        }
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    }
    return this.group;
  }
}

export function palm(b: CityBatch, x: number, z: number, s = 1, rotation = 0) {
  b.beam([x, 0.2, z], [x + 0.45 * s, 5.8 * s, z], 0.16 * s, "#9b8965");
  for (let i = 0; i < 8; i++) {
    b.add(
      "leaf",
      x + 0.45 * s,
      5.8 * s,
      z,
      3.3 * s,
      3.3 * s,
      3.3 * s,
      i % 2 ? "#547f43" : "#71914a",
      rotation + (i * Math.PI) / 4,
    );
  }
  b.sphere(x + 0.45 * s, 5.6 * s, z, 0.35 * s, 0.3 * s, 0.35 * s, "#7b6842");
}

export function tree(b: CityBatch, x: number, z: number, s = 1, variation = 0) {
  b.cylinder(x, 1.35 * s, z, 0.16 * s, 2.7 * s, "#7d7154");
  const greens = ["#4f7950", "#6d8950", "#839a5c", "#47785f"];
  const c = greens[variation % 4];
  for (let i = 0; i < 4; i++) {
    const a = i * 2.4 + variation,
      dx = Math.cos(a) * 0.68 * s,
      dz = Math.sin(a) * 0.68 * s;
    b.beam([x, 1.8 * s, z], [x + dx, 2.9 * s, z + dz], 0.06 * s, "#7d7154");
    b.sphere(
      x + dx,
      (2.7 + (i % 2) * 0.45) * s,
      z + dz,
      (0.9 + (i % 2) * 0.17) * s,
      1.1 * s,
      0.97 * s,
      i % 2 ? c : greens[(variation + 1) % 4],
    );
  }
  b.sphere(x, 3.65 * s, z, 0.83 * s, 0.95 * s, 0.9 * s, c);
}
export function lamp(b: CityBatch, x: number, z: number, rotation = 0) {
  b.cylinder(x, 1.9, z, 0.055, 3.8, "#49595a");
  b.box(
    x + Math.cos(rotation) * 0.35,
    3.82,
    z + Math.sin(rotation) * 0.35,
    0.8,
    0.12,
    0.2,
    "#47535b",
    -rotation,
  );
  b.box(
    x + Math.cos(rotation) * 0.65,
    3.74,
    z + Math.sin(rotation) * 0.65,
    0.35,
    0.05,
    0.3,
    "#fff3cc",
  );
}
export function bench(b: CityBatch, x: number, z: number, r = 0) {
  b.box(x, 0.55, z, 1.6, 0.12, 0.55, "#a37651", r);
  b.box(x, 0.86, z + 0.22, 1.6, 0.55, 0.1, "#a37651", r);
  b.box(x - 0.55, 0.25, z, 0.12, 0.5, 0.42, "#4a5552", r);
  b.box(x + 0.55, 0.25, z, 0.12, 0.5, 0.42, "#4a5552", r);
}
