import * as THREE from "three";
import { CityBatch, palm, bench, lamp } from "./primitives";
import type { CityScene } from "./sceneSchema";

/** Shared coastline parameters keep the terrain, surf and beach props aligned. */
export function coastProfile(half: number, z: number) {
  const length = half * 0.84;
  const extent =
    30 *
    Math.sqrt(Math.max(0, 1 - (z / length) ** 2)) *
    (1 + 0.07 * Math.sin(z * 0.08));
  return { center: half + 61 + 5 * Math.sin(z * 0.032), extent, length };
}
export function createCoast(b: CityBatch, config: CityScene) {
  const half = (config.gridSize * config.blockSize) / 2,
    length = half * 0.84;
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const rows = 120,
    columns = 32;
  const green = new THREE.Color("#8e9b66"),
    sand = new THREE.Color("#e3d5b4"),
    wet = new THREE.Color("#b4ab8d");
  for (let j = 0; j <= rows; j++) {
    const z = -length + (2 * length * j) / rows,
      profile = coastProfile(half, z);
    for (let i = 0; i <= columns; i++) {
      const u = -1 + (2 * i) / columns,
        a = Math.abs(u);
      const y =
        a < 0.64
          ? 0.42 + 0.09 * Math.sin(z * 0.3 + u * 15)
          : 0.42 - ((a - 0.64) / 0.36) * 3.2;
      positions.push(profile.center + u * profile.extent, y, z);
      const c = sand.clone();
      const grass =
        (1 - THREE.MathUtils.smoothstep(u, -0.5, 0.22)) *
        (1 - THREE.MathUtils.smoothstep(a, 0.55, 0.77));
      c.lerp(green, grass * 0.95);
      c.lerp(wet, THREE.MathUtils.smoothstep(a, 0.76, 0.95) * 0.65);
      const grain = 0.97 + Math.sin(i * 127.1 + j * 311.7) * 0.025;
      colors.push(c.r * grain, c.g * grain, c.b * grain);
      if (j < rows && i < columns) {
        const n = j * (columns + 1) + i;
        indices.push(
          n,
          n + columns + 1,
          n + 1,
          n + 1,
          n + columns + 1,
          n + columns + 2,
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const sandMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  sandMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vSand;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvSand=position;",
    );
    shader.fragmentShader = "varying vec3 vSand;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>
      float grain=fract(sin(dot(floor(vSand.xz*48.0),vec2(12.9898,78.233)))*43758.5453);
      float dune=sin(vSand.x*.38+sin(vSand.z*.14)*2.0);
      float ripple=sin(vSand.x*6.0+sin(vSand.z*.7))*0.012;
      float detailFade=1.0-smoothstep(.02,.12,length(fwidth(vSand)));
      diffuseColor.rgb *= .98+(grain-.5)*.04*detailFade+dune*.025+ripple*detailFade;
    `,
    );
  };
  const terrain = new THREE.Mesh(geometry, sandMaterial);
  terrain.receiveShadow = true;
  const boardX = half + 54;
  b.box(boardX, 0.7, 0, 4.4, 0.3, length * 1.53, "#ac9c7d");
  for (let z = -length * 0.76; z < length * 0.76; z += 0.65)
    b.box(boardX, 0.86, z, 4.4, 0.035, 0.045, "#867b66");
  for (let z = -length * 0.7; z < length * 0.71; z += 13) {
    palm(b, boardX - 5, z, 0.95 + Math.sin(z) * 0.1, z);
    bench(b, boardX - 3.1, z + 3, Math.PI / 2);
    lamp(b, boardX - 2.4, z + 7);
    for (let i = 0; i < 3; i++)
      b.sphere(
        boardX - 8 - i * 0.4,
        0.5,
        z + 4 + i * 0.6,
        0.5,
        0.35,
        0.6,
        "#869765",
      );
  }
  for (let z = -length * 0.55; z < length * 0.56; z += 11) {
    if (Math.abs(z) < 22) continue; // Keep the wheel plaza clear.
    const { center, extent } = coastProfile(half, z);
    const x = center + extent * 0.36;
    b.cylinder(x, 1.6, z, 0.055, 2.5, "#d4c4a1");
    b.cone(x, 2.85, z, 1.9, 0.65, Math.round(z) % 3 ? "#e7ddbd" : "#7c9d8e");
    b.sphere(x, 3.2, z, 0.13, 0.12, 0.13, "#b9a688");
    for (const side of [-1, 1]) {
      b.box(x + side * 1.2, 0.68, z + 1.6, 0.72, 0.17, 1.85, "#f0e6cb");
      b.box(x + side * 1.2, 0.9, z + 1, 0.72, 0.35, 0.45, "#e8ddbf");
      b.box(x + side * 1.2, 0.5, z + 1.6, 0.62, 0.22, 1.5, "#9d8c70");
    }
    b.cylinder(x, 0.64, z + 1.6, 0.3, 0.35, "#d7c5a0");
  }
  // Beach club at the north end, raised lifeguard lookout at the south.
  b.box(boardX + 7, 1.8, -length * 0.63, 7, 2.5, 5, "#c6bc9f");
  b.box(boardX + 7, 3.2, -length * 0.63, 8.2, 0.28, 6.3, "#7c9387");
  b.box(
    boardX + 7,
    1.8,
    -length * 0.63 + 2.53,
    5,
    1.2,
    0.08,
    "#4d7379",
    0,
    "glass",
  );
  for (let x = boardX + 3; x < boardX + 12; x += 0.8)
    b.box(x, 3.25, -length * 0.63 + 4, 0.12, 0.12, 3.5, "#a39473");
  const tx = half + 64,
    tz = length * 0.65;
  for (const x of [-1.4, 1.4])
    for (const z of [-1.1, 1.1])
      b.box(tx + x, 1.6, tz + z, 0.18, 2.5, 0.18, "#a39b81");
  b.box(tx, 2.9, tz, 3.6, 0.3, 3.2, "#dfd9bc");
  b.box(tx, 3.9, tz, 3.1, 1.7, 2.6, "#d4d0b4");
  b.box(tx, 4.1, tz + 1.32, 2.7, 0.8, 0.06, "#557d83", 0, "glass");
  b.box(tx, 4.9, tz, 3.8, 0.22, 3.4, "#91a399");
  for (let n = 0; n < 6; n++)
    b.box(tx, 0.7 + n * 0.38, tz + 3.5 - n * 0.35, 1.2, 0.15, 0.45, "#b1a58a");
  // Sculpted rocks and grass mark the quieter ends of the beach.
  for (const side of [-1, 1])
    for (let i = 0; i < 12; i++) {
      const z = side * (length * 0.72 + i * 0.9),
        p = coastProfile(half, z);
      b.sphere(
        p.center - p.extent * 0.55 + (i % 3),
        0.05,
        z,
        1.3 + (i % 3) * 0.3,
        0.65,
        1.1,
        i % 2 ? "#a7a48c" : "#8b9383",
      );
    }
  return terrain;
}

export function createWater(config: CityScene) {
  const half = (config.gridSize * config.blockSize) / 2;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      halfCity: { value: half },
      nightAmount: { value: 0 },
    },
    vertexShader: `
      varying vec3 p;
      uniform float time;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.0);
        world.y += sin(world.x*.12+world.z*.18+time*.8)*.07 + sin(world.z*.23-world.x*.09-time*.6)*.045;
        p=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `
      varying vec3 p;
      uniform float time;
      uniform float halfCity;
      uniform float nightAmount;
      float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 v){vec2 i=floor(v),f=fract(v); f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
      void main(){
        float L=halfCity*.84;
        float radius=30.0*sqrt(max(0.0,1.0-p.z*p.z/(L*L)))*(1.0+.07*sin(p.z*.08));
        float center=halfCity+61.0+5.0*sin(p.z*.032);
        float shore=abs(p.x-center)-radius*.89;
        float coast=1.0-smoothstep(L-5.0,L+8.0,abs(p.z));
        float shallow=(1.0-smoothstep(-1.0,23.0,shore))*coast;
        float broad=noise(p.xz*.038+vec2(time*.012,-time*.008));
        float detail=noise(p.xz*.55+vec2(time*.05,time*.03));
        float detail2=noise(p.xz*.9+vec2(-time*.03,time*.035));
        float swell=sin(p.x*.12+p.z*.18+time*.7+broad*5.0);
        float attenuation=1.0-smoothstep(140.0,700.0,distance(cameraPosition.xz,p.xz));
        vec3 normal=normalize(vec3((detail-.5)*.1+(swell*.018),1.0,(detail2-.5)*.1))*vec3(attenuation,1.0,attenuation);
        normal=normalize(normal);
        vec3 eye=normalize(cameraPosition-p);
        float fresnel=pow(1.0-max(dot(eye,normal),0.0),4.0);
        vec3 c=mix(vec3(.037,.17,.205),vec3(.19,.42,.39),shallow);
        c+=(broad-.5)*.012+(detail-.5)*.008*attenuation;
        c=mix(c,vec3(.35,.54,.58),fresnel*.55);
        float glint=pow(max(dot(reflect(-normalize(vec3(-.45,1.0,.5)),normal),eye),0.0),150.0);
        c+=vec3(.95,.87,.65)*glint*.45;
        float distortion=noise(vec2(p.z*.23,time*.14))*1.8;
        float wave=sin(shore*.9+time*1.15+distortion);
        float band=smoothstep(.84,.99,wave);
        float fade=(1.0-smoothstep(1.0,15.0,shore))*smoothstep(-2.5,.5,shore)*coast;
        float foam=band*fade*(.3+.7*noise(p.xz*1.8+time*.1));
        float wash=(1.0-smoothstep(0.0,1.6,abs(shore-1.0-sin(time*.75+p.z*.07)*.75)))*coast;
        c=mix(c,vec3(.72,.84,.78),max(foam*.65,wash*.3));
        float horizon=smoothstep(300.0,1000.0,length(p.xz));
        c=mix(c,vec3(.56,.68,.69),horizon);
        vec3 nightColor=mix(vec3(.008,.019,.045),vec3(.018,.085,.11),shallow);
        nightColor+=vec3(.25,.35,.48)*glint*.6;
        float reflected=exp(-abs(p.x-(halfCity+58.))*.075)*coast;
        float ripple=pow(.5+.5*sin(p.z*2.+p.x*.35+time*.8+detail*5.),9.);
        nightColor+=vec3(.4,.21,.075)*reflected*ripple*.35;
        nightColor+=vec3(.1,.24,.27)*max(foam*.22,wash*.06);
        nightColor=mix(nightColor,vec3(.014,.025,.05),horizon);
        c=mix(c,nightColor,nightAmount);
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400, 200, 200),
    material,
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.8;
  return { mesh, material };
}
