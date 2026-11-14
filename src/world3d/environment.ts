import { CityBatch, tree, bench, lamp } from "./primitives";
import type { CityScene } from "./sceneSchema";

export function park(
  b: CityBatch,
  x: number,
  z: number,
  size: number,
  random: () => number,
  court = false,
) {
  b.box(x, 0.28, z, size, 0.25, size, "#6e954d");
  b.box(x, 0.43, z, size, 0.06, 1.7, "#e4d5b5");
  b.box(x, 0.43, z, 1.7, 0.06, size, "#e4d5b5");
  if (court) {
    b.box(x, 0.48, z, 9, 0.08, 13, "#769e92");
    for (const dx of [-4, 4]) b.box(x + dx, 0.53, z, 0.08, 0.02, 11, "#f0ead8");
    for (const dz of [-5.5, 0, 5.5])
      b.box(x, 0.53, z + dz, 8, 0.02, 0.08, "#f0ead8");
    b.box(x, 1.1, z, 9, 1.2, 0.045, "#d5ded2");
  } else {
    b.cylinder(x, 0.65, z, 2.9, 0.5, "#dfdac8");
    b.cylinder(x, 0.93, z, 2.6, 0.09, "#78c4be");
    b.cylinder(x, 1.45, z, 0.55, 1, "#dad9c8");
    b.sphere(x, 2.15, z, 0.6, 0.9, 0.6, "#b1e3db");
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4,
      r = size * 0.37;
    tree(b, x + Math.cos(a) * r, z + Math.sin(a) * r, 0.7 + random() * 0.45, i);
  }
  bench(b, x - 4, z + 4);
  bench(b, x + 4, z - 4);
  for (let i = 0; i < 8; i++)
    b.sphere(
      x - size * 0.4 + i * size * 0.11,
      0.65,
      z + size * 0.43,
      0.65,
      0.45,
      0.6,
      i % 2 ? "#d4b46e" : "#a9bd7b",
    );
}

export { grandPanchayat as civicPlaza } from "./civicLandmarks";

export function groundAndRoads(b: CityBatch, s: CityScene) {
  const half = (s.gridSize * s.blockSize) / 2,
    span = half * 2,
    rw = s.roadWidth;
  b.box(0, -1.3, 0, span + 14, 2.5, span + 14, "#bbac8f");
  b.box(0, 0.02, 0, span + 13, 0.16, span + 13, "#aab38c");
  for (let i = 0; i <= s.gridSize; i++) {
    const k = -half + i * s.blockSize;
    b.box(k, 0.14, 0, rw, 0.1, span + rw, "#384448");
    b.box(0, 0.14, k, span + rw, 0.1, rw, "#384448");
    for (let j = 0; j < s.gridSize; j++) {
      const p = -half + j * s.blockSize;
      for (let t = rw * 0.7; t < s.blockSize - rw * 0.7; t += 4) {
        b.box(k, 0.205, p + t, 0.09, 0.018, 1.8, "#e6ddae");
        b.box(p + t, 0.205, k, 1.8, 0.018, 0.09, "#e6ddae");
      }
    }
  }
  for (let row = 0; row < s.gridSize; row++)
    for (let col = 0; col < s.gridSize; col++) {
      const x = -half + (col + 0.5) * s.blockSize,
        z = -half + (row + 0.5) * s.blockSize,
        w = s.blockSize - rw;
      b.box(x, 0.22, z, w, 0.25, w, "#cacbbf");
      b.box(x, 0.355, z, w - 1.6, 0.04, w - 1.6, "#b6bca9");
      for (const dx of [-1, 1])
        for (const dz of [-1, 1])
          lamp(b, x + dx * (w / 2 - 1), z + dz * (w / 2 - 1));
      for (let k = -2; k <= 2; k++) {
        b.box(
          x - w / 2 - rw / 2 + k * 0.95,
          0.21,
          z - w / 2 + 1,
          0.42,
          0.015,
          1.6,
          "#e7e7d5",
        );
        b.box(
          x - w / 2 + 1,
          0.21,
          z - w / 2 - rw / 2 + k * 0.95,
          1.6,
          0.015,
          0.42,
          "#e7e7d5",
        );
      }
      b.cylinder(x - w / 2 + 0.3, 1.5, z - w / 2 + 0.3, 0.06, 3, "#566766");
      b.box(x - w / 2 + 0.3, 2.8, z - w / 2 + 0.3, 0.35, 0.7, 0.25, "#34494c");
      b.sphere(
        x - w / 2 + 0.3,
        2.7,
        z - w / 2 + 0.46,
        0.095,
        0.095,
        0.04,
        "#87c17c",
      );
    }
  b.box(half + 6, 0.32, 0, 5, 0.6, span + 8, "#e6d7b5");
  for (let z = -half; z < half; z += 7) {
    tree(b, half + 5, z, 0.8, Math.abs(Math.round(z)) % 4);
    bench(b, half + 7, z + 2, Math.PI / 2);
  }
  for (const z of [-s.blockSize * 2, s.blockSize * 2]) {
    b.box(half + 32, 0.7, z, 65, 1.1, 5.8, "#d7cbb1");
    b.box(half + 32, 1.28, z, 65, 0.08, 4.3, "#83958c");
    for (const dz of [-2.8, 2.8])
      b.box(half + 32, 1.8, z + dz, 65, 0.6, 0.15, "#e7dfce");
    for (let x = half + 12; x < half + 57; x += 16)
      b.cylinder(x, -1.5, z, 1, 4, "#baa98b");
  }
}

export { createWater } from "./coast";
