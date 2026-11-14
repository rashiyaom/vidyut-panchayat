import { CityBatch, tree, bench, lamp } from "./primitives";

const stone = "#ddceb0",
  trim = "#eee3c9",
  metal = "#6c8582",
  glass = "#416b73";
function rail(
  b: CityBatch,
  x: number,
  z: number,
  w: number,
  d: number,
  y: number,
) {
  for (const dz of [-d / 2, d / 2]) {
    b.box(x, y + 0.8, z + dz, w, 0.07, 0.07, metal);
    for (let dx = -w / 2; dx <= w / 2; dx += 0.7)
      b.box(x + dx, y + 0.4, z + dz, 0.05, 0.8, 0.05, metal);
  }
}
function arch(
  b: CityBatch,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
) {
  for (const side of [-1, 1]) {
    b.cylinder(x + side * r, y + h / 2, z, 0.15, h, trim);
    b.box(x + side * r, y + 0.15, z, 0.48, 0.3, 0.48, stone);
    b.box(x + side * r, y + h - 0.1, z, 0.42, 0.25, 0.42, trim);
  }
  for (let n = 0; n < 12; n++) {
    const a = (n * Math.PI) / 12,
      c = ((n + 1) * Math.PI) / 12;
    b.beam(
      [x + Math.cos(a) * r, y + h + Math.sin(a) * r, z],
      [x + Math.cos(c) * r, y + h + Math.sin(c) * r, z],
      0.16,
      trim,
    );
  }
}
function clockFace(b: CityBatch, x: number, y: number, z: number) {
  b.sphere(x, y, z, 0.82, 0.82, 0.12, "#e6d4aa");
  b.sphere(x, y, z + 0.1, 0.69, 0.69, 0.04, "#f5ecd6");
  b.box(x, y + 0.18, z + 0.16, 0.065, 0.44, 0.04, "#405b59");
  b.beam([x, y, z + 0.17], [x + 0.34, y - 0.14, z + 0.17], 0.035, "#405b59");
  for (let n = 0; n < 12; n++) {
    const a = (n * Math.PI) / 6;
    b.box(
      x + Math.sin(a) * 0.57,
      y + Math.cos(a) * 0.57,
      z + 0.16,
      0.06,
      0.08,
      0.035,
      "#405b59",
    );
  }
}

export function grandPanchayat(b: CityBatch) {
  b.box(0, 0.48, 0, 20, 0.3, 20, "#cbbd9e");
  for (let n = 0; n < 4; n++)
    b.box(
      0,
      0.66 + n * 0.2,
      3.8 + n * 0.38,
      11.8 - n * 0.4,
      0.22,
      2.6 - n * 0.48,
      stone,
    );
  b.box(0, 1.0, -2, 18, 0.8, 12, stone);
  b.box(0, 5, -3, 9, 7.2, 9, "#d3bc96");
  for (const side of [-1, 1]) {
    const x = side * 6.8;
    b.box(x, 3.5, -3, 4.3, 4.8, 9, "#c8b18d");
    b.box(x, 6.0, -3, 4.8, 0.36, 9.5, trim);
    for (const z of [-6, -3, 0]) {
      b.box(x + side * 2.17, 3.7, z, 0.08, 2.7, 1.35, glass, 0, "glass");
      for (const dy of [2.6, 3.4, 4.2, 5])
        b.box(x + side * 2.25, dy, z, 0.1, 0.08, 1.48, trim);
    }
    arch(b, x, 1.45, 1.7, 0.9, 2.5);
    b.box(x, 3.1, 1.53, 1.6, 2.8, 0.1, glass, 0, "glass");
    // Open corner pavilions with small copper domes.
    for (const dx of [-1.15, 1.15])
      for (const dz of [-1.15, 1.15])
        b.cylinder(x + dx, 7.1, -4 + dz, 0.12, 1.9, trim);
    b.box(x, 8.1, -4, 3, 0.25, 3, trim);
    b.sphere(x, 8.3, -4, 1.4, 1.05, 1.4, "#668f83");
    b.cylinder(x, 9.5, -4, 0.09, 0.65, "#c7a35f");
    rail(b, x, -0.2, 4.4, 3.1, 6.2);
  }
  // Deep colonnaded portico, carved cornices and a monumental entrance.
  b.box(0, 4.1, 1.56, 2.2, 4.5, 0.12, "#5e6e62");
  for (const x of [-3, 0, 3]) arch(b, x, 1.4, 3, 0.98, 3.3);
  b.box(0, 6.0, 2.2, 10.2, 0.45, 3, trim);
  b.add("roof", 0, 7, 2.2, 10.5, 1.7, 3.2, stone);
  for (const y of [7.6, 8.4, 9]) b.box(0, y, -3, 9.5, 0.24, 9.5, trim);
  for (let x = -4; x <= 4; x += 0.5)
    b.box(x, 8.7, 1.8, 0.17, 0.34, 0.22, "#b9a17a");
  b.cylinder(0, 10.3, -3, 3.65, 2.4, stone);
  for (let n = 0; n < 16; n++) {
    const a = (n * Math.PI) / 8;
    b.box(
      Math.sin(a) * 3.63,
      10.3,
      -3 + Math.cos(a) * 3.63,
      0.55,
      1.4,
      0.12,
      glass,
      a,
      "glass",
    );
  }
  b.cylinder(0, 11.6, -3, 3.95, 0.3, trim);
  b.sphere(0, 12.3, -3, 3.8, 3.3, 3.8, "#60877c");
  for (let n = 0; n < 16; n++) {
    const a = (n * Math.PI) / 8;
    for (let j = 0; j < 7; j++) {
      const t = (j * Math.PI) / 14,
        u = ((j + 1) * Math.PI) / 14;
      b.beam(
        [
          Math.cos(a) * 3.82 * Math.cos(t),
          12.3 + 3.32 * Math.sin(t),
          -3 + Math.sin(a) * 3.82 * Math.cos(t),
        ],
        [
          Math.cos(a) * 3.82 * Math.cos(u),
          12.3 + 3.32 * Math.sin(u),
          -3 + Math.sin(a) * 3.82 * Math.cos(u),
        ],
        0.035,
        "#b9ba91",
      );
    }
  }
  b.cylinder(0, 16, -3, 0.18, 1.1, "#d3b168");
  b.sphere(0, 16.65, -3, 0.26, 0.3, 0.26, "#d3b168");
  clockFace(b, 0, 7, 3.8);
  // Formal forecourt: inlaid paving, reflecting fountain, hedges and flagpoles.
  for (const side of [-1, 1]) {
    const x = side * 7;
    b.box(x, 0.7, 6, 3, 0.25, 5, "#e4d8ba");
    b.box(x, 0.87, 6, 2.5, 0.12, 4.5, "#668057");
    tree(b, x, 6, 0.72, 1);
    bench(b, x, 8.8);
    lamp(b, side * 9, 3);
    b.cylinder(side * 4.8, 4, 5, 0.055, 6.5, metal);
    for (let i = 0; i < 3; i++)
      b.box(
        side * 4.8 + 0.65,
        6.8 - i * 0.26,
        5,
        1.3,
        0.26,
        0.045,
        ["#c68c57", "#efe9d6", "#557e58"][i],
      );
  }
  for (const x of [-2.8, 2.8]) b.box(x, 0.67, 7.5, 0.18, 0.025, 4, "#9d8a66");
  b.cylinder(0, 0.9, 7.6, 1.8, 0.5, stone);
  b.cylinder(0, 1.17, 7.6, 1.55, 0.08, "#6caeac");
  b.cylinder(0, 1.6, 7.6, 0.34, 0.8, trim);
  b.cylinder(0, 2.0, 7.6, 0.8, 0.15, stone);
  for (let n = 0; n < 8; n++) {
    const a = (n * Math.PI) / 4;
    b.beam(
      [0, 2, 7.6],
      [Math.cos(a) * 1.2, 1.2, 7.6 + Math.sin(a) * 1.2],
      0.035,
      "#b5dbd2",
    );
  }
}

export function detailedStation(b: CityBatch) {
  b.box(0, 0.5, 0, 19, 0.3, 19, "#b9bdb0");
  b.box(0, 2.8, -6.7, 18, 4.5, 4, "#c3baa4");
  b.box(0, 5.15, -6.7, 18.6, 0.3, 4.6, trim);
  b.box(0, 6, -6.5, 3.4, 2, 3.8, stone);
  b.box(0, 7.15, -6.5, 4, 0.25, 4.3, trim);
  clockFace(b, 0, 6, -4.54);
  for (const x of [-7, -4, 4, 7]) {
    b.box(x, 2.7, -4.65, 2.2, 2.7, 0.08, glass, 0, "glass");
    b.box(x, 2.7, -4.55, 0.09, 2.7, 0.08, trim);
  }
  for (const x of [-4.8, 4.8]) {
    for (const dx of [-0.7, 0.7])
      b.box(x + dx, 0.74, 1, 0.12, 0.14, 14, "#78827e");
    for (let z = -5; z < 8; z += 0.7)
      b.box(x, 0.64, z, 2, 0.12, 0.18, "#8e806b");
    b.box(x, 1.35, 0.5, 2.4, 1.1, 9, "#a0b8ae");
    b.box(x, 2.2, 0.5, 2.35, 0.75, 8.8, "#d9d8c5");
    b.box(x, 2.65, 0.5, 2.45, 0.18, 9, "#d6d8ce");
    for (let z = -3.2; z <= 4.3; z += 1.3)
      for (const side of [-1, 1])
        b.box(x + side * 1.19, 2.2, z, 0.065, 0.52, 0.88, glass, 0, "glass");
    b.box(x, 2.1, 5.04, 1.9, 0.65, 0.07, glass, 0, "glass");
    for (const dx of [-0.8, 0.8])
      b.sphere(x + dx, 1.55, 5.08, 0.13, 0.1, 0.05, "#f2dfaf");
  }
  for (const x of [-8, 0, 8]) {
    b.box(x, 0.9, 1, 2, 0.35, 13, "#d7cfb9");
    for (const dx of [-0.85, 0.85])
      b.box(x + dx, 1.09, 1, 0.14, 0.035, 12.7, "#d8b96c");
    for (const z of [-3, 2, 6]) {
      b.cylinder(x, 2.8, z, 0.1, 3.8, metal);
      b.beam([x, 3.6, z], [x - 1.6, 4.65, z], 0.08, metal);
      b.beam([x, 3.6, z], [x + 1.6, 4.65, z], 0.08, metal);
    }
    b.box(x, 4.78, 1, 3.8, 0.15, 12, "#a3bfbb", 0, "glass");
    for (let z = -4.5; z < 7; z += 1.5) b.box(x, 4.9, z, 3.9, 0.08, 0.1, trim);
  }
  for (const z of [-2, 4]) bench(b, 0, z);
  for (const x of [-7, 7]) {
    b.box(x, 1.2, 8.5, 1.1, 1.3, 0.75, "#607d77");
    b.box(x, 1.5, 8.9, 0.65, 0.5, 0.05, "#b4c8be");
  }
  return 7.5;
}

export function waterworksDetails(b: CityBatch) {
  for (const x of [-4.5, 4.5])
    for (const z of [-3, 5]) {
      for (let n = 0; n < 16; n++) {
        const a = (n * Math.PI) / 8,
          c = ((n + 1) * Math.PI) / 8;
        b.beam(
          [x + Math.cos(a) * 3.2, 3.15, z + Math.sin(a) * 3.2],
          [x + Math.cos(c) * 3.2, 3.15, z + Math.sin(c) * 3.2],
          0.035,
          metal,
        );
        if (n % 2 === 0)
          b.cylinder(
            x + Math.cos(a) * 3.2,
            2.7,
            z + Math.sin(a) * 3.2,
            0.035,
            0.9,
            metal,
          );
      }
      b.beam([x, 2.5, z], [x + 2.8, 2.5, z], 0.055, "#5b797b");
      b.beam([x, 2.5, z], [x - 2.8, 2.5, z], 0.055, "#5b797b");
      b.cylinder(x, 2.55, z, 0.38, 0.35, metal);
      for (let n = 0; n < 6; n++)
        b.box(x + 3.5, 0.6 + n * 0.35, z, 0.5, 0.06, 0.12, metal);
    }
  for (const x of [-1, 1]) {
    b.beam([x, 0.7, -7], [x, 0.7, 8], 0.18, "#548a93");
    b.cylinder(x, 1, -0.3, 0.27, 0.7, "#cba46c");
    b.cylinder(x, 1.4, -0.3, 0.42, 0.1, "#ad6650");
  }
  for (const x of [-4.5, -1.5, 1.5, 4.5])
    b.box(x, 4.0, -8, 2.4, 0.12, 1.7, "#395f6f", 0, "glass");
}
export function firehouseDetails(b: CityBatch) {
  for (let i = 0; i < 3; i++) {
    const x = -1 + i * 4;
    for (const dx of [-1.7, 1.7])
      b.box(x + dx, 1.7, 7.75, 0.18, 3.3, 0.22, trim);
    b.box(x, 3.5, 7.75, 3.6, 0.25, 0.25, trim);
    b.box(x, 3.95, 7.65, 0.65, 0.4, 0.08, "#e6d4b0");
  }
  // A parked rescue tender with hose reels, equipment lockers and roof ladder.
  const x = 3,
    z = 7;
  b.box(x, 0.9, z, 2.2, 0.65, 4.8, "#a8453d");
  b.box(x, 1.65, z - 1, 2.2, 1, 2.7, "#b85043");
  b.box(x, 1.65, z + 1.25, 2.2, 1, 1.5, "#c25b48");
  b.box(x, 1.9, z + 2.03, 1.8, 0.5, 0.06, glass, 0, "glass");
  b.box(x, 2.25, z + 1.2, 1.6, 0.13, 0.35, "#668ea7");
  for (const side of [-1, 1])
    for (const dz of [-1.5, 1.45])
      b.sphere(x + side * 1.1, 0.65, z + dz, 0.18, 0.42, 0.42, "#394747");
  for (const side of [-1, 1]) {
    b.box(x + side * 1.12, 1.5, z - 1, 0.05, 0.7, 2, "#b5b9ad");
    b.box(x + side * 0.6, 2.3, z - 0.7, 0.08, 0.08, 3.2, metal);
  }
  for (let n = 0; n < 8; n++)
    b.box(x, 2.33, z - 2 + n * 0.4, 1.3, 0.06, 0.07, metal);
  b.cylinder(-8, 0.9, 7, 0.2, 1.2, "#b85743");
  b.box(-8, 1.1, 7, 0.8, 0.15, 0.2, "#b85743");
  // Training/hose tower and rooftop ventilation.
  b.box(8, 4.2, -6, 2.5, 7.8, 2.8, "#b58a70");
  b.box(8, 8.25, -6, 2.9, 0.3, 3.2, trim);
  for (let y = 2; y < 8; y += 1.7)
    b.box(8, y, -4.57, 0.8, 0.9, 0.07, glass, 0, "glass");
  for (const x of [0, 4]) {
    b.box(x, 5.7, 0, 1.6, 0.7, 1.8, "#b1b9ae");
    for (let n = 0; n < 5; n++)
      b.box(x, 6.07, -0.6 + n * 0.3, 1.4, 0.04, 0.1, metal);
  }
}
export function substationDetails(b: CityBatch) {
  for (const x of [-5, 0, 5]) {
    b.cylinder(x, 4.5, 0, 0.32, 0.35, "#6e6255");
    for (const z of [-1.2, 1.2]) {
      b.cylinder(x, 3.5, z, 0.18, 1.1, "#8a7762");
      for (let n = 0; n < 5; n++)
        b.cylinder(x, 3.1 + n * 0.2, z, 0.32, 0.07, "#b8a58a");
      b.beam([x, 4.1, z], [x, 6.8, z < 0 ? -7 : 7], 0.045, "#657c77");
    }
    b.cylinder(x, 3.7, 0, 0.52, 0.3, "#aeb7ac");
  }
  for (const z of [-7, 7])
    for (const x of [-7, 7]) {
      for (let y = 1; y < 7; y += 1.2)
        b.beam([x - 0.6, y, z], [x + 0.6, y + 1.2, z], 0.055, metal);
      for (const dx of [-0.6, 0.6]) b.box(x + dx, 4, z, 0.08, 7.5, 0.08, metal);
    }
  for (const x of [-9, 9])
    for (let z = -9; z <= 9; z += 0.75) b.box(x, 1.4, z, 0.06, 2, 0.06, metal);
  for (const y of [0.6, 2.3]) {
    for (const x of [-9, 9]) b.box(x, y, 0, 0.07, 0.07, 18, metal);
    for (const z of [-9, 9]) b.box(0, y, z, 18, 0.07, 0.07, metal);
  }
  for (const x of [-7, 7]) {
    b.box(x, 1.3, 4, 1.3, 1.8, 1.3, "#bfc4b8");
    b.box(x, 1.5, 4.67, 0.65, 0.5, 0.04, "#d4b15d");
  }
  for (const x of [-4, 0, 4])
    for (let n = 0; n < 6; n++)
      b.cylinder(x, 6.8 + n * 0.17, -7, 0.38, 0.06, "#b6a58d");
}
