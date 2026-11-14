import {
  detailedStation,
  waterworksDetails,
  firehouseDetails,
  substationDetails,
} from "./civicLandmarks";
import { CityBatch, tree, bench } from "./primitives";
import type { Facility } from "./sceneSchema";

const glass = ["#638e98", "#7ca3ab", "#496e7d", "#a9c9c9"];
export function building(
  b: CityBatch,
  x: number,
  z: number,
  w: number,
  d: number,
  floors: number,
  color: string,
  style = "apartment",
  random = () => 0.5,
) {
  const floor = 2.35;
  const h = floors * floor + 1.1;
  b.box(x, h / 2 + 0.22, z, w, h, d, color);
  b.box(x, 0.4, z, w + 0.3, 0.45, d + 0.3, "#dedbcd");
  // Recessed glazing, horizontal cornices and repeated balconies give buildings scale.
  for (let f = 0; f < floors; f++) {
    const y = 2.0 + f * floor;
    if (style === "office")
      b.box(x, y - 0.9, z, w + 0.15, 0.18, d + 0.15, "#d8e0dc");
    for (let side = 0; side < 4; side++) {
      const count = Math.max(2, Math.floor((side % 2 === 0 ? w : d) / 1.65));
      for (let n = 0; n < count; n++) {
        const along =
          ((n - (count - 1) / 2) * ((side % 2 === 0 ? w : d) - 1.15)) / count;
        const wx =
          x +
          (side === 0 || side === 2
            ? along
            : side === 1
              ? w / 2 + 0.02
              : -w / 2 - 0.02);
        const wz =
          z +
          (side === 1 || side === 3
            ? along
            : side === 0
              ? d / 2 + 0.02
              : -d / 2 - 0.02);
        const pane =
          style === "office"
            ? ((side % 2 === 0 ? w : d) - 1.15) / count - 0.12
            : 1.04;
        const ww = side % 2 === 0 ? pane : 0.06,
          dd = side % 2 === 0 ? 0.06 : pane;
        b.box(
          wx,
          y,
          wz,
          ww,
          1.25,
          dd,
          glass[Math.floor(random() * glass.length)],
          0,
          "glass",
        );
        if (style === "apartment" && f > 0 && n % 2 === 0 && side === 0) {
          b.box(wx, y - 0.7, wz + 0.32, 1.4, 0.12, 0.8, "#eee9dc");
          b.box(wx, y - 0.38, wz + 0.68, 1.4, 0.48, 0.065, "#a3b4ad");
        }
        if (style === "heritage")
          b.box(
            wx,
            y + 0.72,
            wz,
            side % 2 === 0 ? 1.3 : 0.16,
            0.16,
            side % 2 === 0 ? 0.16 : 1.3,
            "#efe8d7",
          );
      }
    }
  }
  b.box(x, h + 0.3, z, w + 0.48, 0.35, d + 0.48, "#eee8d8");
  b.box(
    x,
    h + 0.5,
    z,
    w - 0.45,
    0.12,
    d - 0.45,
    style === "office" ? "#7b9293" : "#8a9791",
  );
  // Parapets, rooftop plant and elevator housings.
  b.box(x, h + 0.68, z - d / 2, w + 0.3, 0.65, 0.22, "#e6e3d5");
  b.box(x, h + 0.68, z + d / 2, w + 0.3, 0.65, 0.22, "#e6e3d5");
  b.box(x - w / 2, h + 0.68, z, 0.22, 0.65, d, "#e6e3d5");
  b.box(x + w / 2, h + 0.68, z, 0.22, 0.65, d, "#e6e3d5");
  b.box(x - w * 0.2, h + 1, z - d * 0.15, w * 0.32, 1.2, d * 0.28, "#b7bcb4");
  b.box(x + w * 0.22, h + 0.8, z + d * 0.2, 1.1, 0.6, 1.4, "#b9c4c2");
  for (let n = 0; n < 3; n++)
    b.box(
      x + w * 0.22,
      h + 1.13,
      z + d * 0.2 - 0.4 + n * 0.4,
      1.1,
      0.05,
      0.08,
      "#758685",
    );
  if (style === "heritage") {
    const roofColor = ["#536367", "#657473", "#747b71", "#806d5b"][
      Math.floor(random() * 4)
    ];
    b.add("roof", x, h + 1.4, z, w + 0.55, 2.4, d + 0.5, roofColor);
    b.box(x, h + 2.66, z, 0.16, 0.14, d + 0.5, "#5b6665");
    b.box(x - w * 0.28, h + 2.3, z - 0.4, 0.7, 1.5, 0.7, "#b9a58a");
  }
  if (style !== "office") {
    const awning = random() > 0.5 ? "#447e79" : "#bd735b";
    b.box(
      x,
      0.95,
      z + d / 2 + 0.06,
      w * 0.7,
      1.65,
      0.08,
      "#4c767b",
      0,
      "glass",
    );
    b.box(x, 2.0, z + d / 2 + 0.48, w * 0.86, 0.17, 0.95, awning);
    for (let k = 0; k < 4; k++)
      b.box(
        x - w * 0.32 + k * w * 0.21,
        1.96,
        z + d / 2 + 0.49,
        0.25,
        0.18,
        0.97,
        "#eee7d5",
      );
  }
  return h + 2.5;
}

function cross(b: CityBatch, x: number, y: number, z: number, s = 1) {
  b.box(x, y, z, 2 * s, 0.2, 0.6 * s, "#d9514d");
  b.box(x, y + 0.01, z, 0.6 * s, 0.2, 2 * s, "#d9514d");
}

export function facility(
  b: CityBatch,
  f: Facility,
  random: () => number,
): number {
  switch (f.kind) {
    case "hospital": {
      building(b, 0, -2, 12, 8, 5, f.color, "office", random);
      building(b, -5, 4, 5, 7, 2, f.color, "office", random);
      building(b, 5, 4, 5, 7, 2, f.color, "office", random);
      b.cylinder(0, 13.7, -2, 3, 0.12, "#6b8f7a");
      cross(b, 0, 13.82, -2, 1.7);
      b.box(0, 1.2, 7, 3.2, 2.3, 0.1, "#547d87", 0, "glass");
      b.box(0, 2.5, 8, 5, 0.3, 3, "#d96b5a");
      cross(b, 0, 2.72, 8, 0.9);
      return 16;
    }
    case "commercial": {
      building(b, 0, 0, 11, 10, 10, f.color, "office", random);
      building(b, 0, -1, 8, 7, 13, "#91b9be", "office", random);
      b.box(0, 33, -1, 6, 0.8, 5, "#d6ded4");
      b.cylinder(0, 36, -1, 0.1, 6, "#d4d9d2");
      return 39;
    }
    case "water": {
      for (const x of [-4.5, 4.5])
        for (const z of [-3, 5]) {
          b.cylinder(x, 1.2, z, 3.4, 2.0, "#d5ded4");
          b.cylinder(x, 2.25, z, 3.02, 0.12, "#57aeb4");
          b.cylinder(x, 2.34, z, 0.16, 0.2, "#e3ddc2");
          b.box(x, 2.45, z, 6, 0.12, 0.24, "#bbc5bc");
        }
      building(b, 0, -8, 12, 3, 1, "#bfcab8", "office", random);
      waterworksDetails(b);
      return 5;
    }
    case "telecom": {
      building(b, 0, 1, 8, 8, 2, f.color, "office", random);
      b.cylinder(0, 17, 0, 0.25, 22, "#d2d4ce");
      for (let n = 0; n < 6; n++) {
        const y = 7 + n * 3;
        b.box(0, y, 0, 5 - n * 0.55, 0.15, 5 - n * 0.55, "#bcc8c2");
      }
      for (const x of [-1.3, 1.3]) {
        b.box(x, 24, 0, 0.35, 3.5, 0.7, "#ece7d9");
        b.sphere(x * 1.3, 19, 0, 0.8, 0.8, 0.3, "#e7e3d3");
      }
      b.sphere(0, 28, 0, 0.2, 0.25, 0.2, "#d35747");
      return 29;
    }
    case "emergency": {
      building(b, -4, -3, 7, 9, 3, f.color, "heritage", random);
      b.box(3, 2.5, -3.4, 12, 5, 0.25, "#ba6a51");
      for (const x of [-2.9, 8.9]) b.box(x, 2.5, 2, 0.25, 5, 11, "#ba6a51");
      b.box(3, 0.38, 2, 12, 0.15, 11, "#a5a59a");
      b.box(3, 5.2, 2, 12.5, 0.4, 11.5, "#e2d6be");
      for (let i = 0; i < 3; i++) {
        if (i === 1) {
          b.box(3, 4.35, 7.55, 3.2, 1.25, 0.1, "#893f36");
          continue;
        }
        b.box(-1 + i * 4, 1.7, 7.55, 3.2, 3.1, 0.1, "#893f36");
        for (let k = 0; k < 4; k++)
          b.box(-1 + i * 4, 0.7 + k * 0.6, 7.62, 3, 0.08, 0.1, "#bc8c73");
      }
      b.cylinder(8, 5, -6, 0.1, 10, "#6d7f78");
      b.box(8.8, 9, -6, 1.6, 0.9, 0.06, "#df7950");
      firehouseDetails(b);
      return 12;
    }
    case "substation": {
      b.box(0, 0.24, 0, 19, 0.18, 19, "#c1c4ba");
      for (const x of [-5, 0, 5]) {
        b.box(x, 1.6, 0, 2.7, 3, 4, "#8c9e97");
        for (let i = 0; i < 4; i++)
          b.box(x - 1 + i * 0.65, 1.6, 0, 0.13, 2.8, 4.4, "#b2bfb8");
        b.cylinder(x, 3.8, 0, 0.25, 1.6, "#6c6058");
      }
      for (const z of [-7, 7]) {
        for (const x of [-7, 7]) b.cylinder(x, 4, z, 0.15, 8, "#a2b0a9");
        b.box(0, 7.8, z, 14, 0.35, 0.35, "#b6c1b8");
        for (const x of [-4, 0, 4]) b.cylinder(x, 7.2, z, 0.3, 1.1, "#776856");
      }
      for (let i = -9; i <= 9; i += 1.5) {
        b.box(i, 1, -9, 0.07, 2, 0.1, "#859891");
        b.box(i, 1, 9, 0.07, 2, 0.1, "#859891");
      }
      substationDetails(b);
      return 9;
    }
    case "fuel": {
      for (const x of [-4.5, 4.5]) {
        b.cylinder(x, 3, -2, 3.5, 5.6, "#ede6d6");
        b.cylinder(x, 3.2, -2, 3.52, 0.6, "#ca7c5b");
        b.cone(x, 6, -2, 3.6, 0.8, "#c1ccc5");
      }
      building(b, 0, 7, 15, 4, 1, "#c9be9f", "office", random);
      b.box(0, 0.5, -7, 13, 0.3, 0.5, "#a7b7ac");
      return 7;
    }
    case "transit":
      return detailedStation(b);
    case "shelter": {
      building(b, 0, -3, 14, 8, 2, f.color, "heritage", random);
      b.box(0, 0.26, 5, 15, 0.12, 7, "#cfbc97");
      for (const x of [-6, 6]) {
        tree(b, x, 6, 0.8);
        bench(b, x, 8);
      }
      b.cylinder(0, 1, 6, 1.8, 1.2, "#c8bba2");
      b.cylinder(0, 1.65, 6, 1.6, 0.1, "#7ac4bf");
      return 9;
    }
    case "traffic":
      building(b, 0, 0, 12, 11, 3, f.color, "office", random);
      b.cylinder(5, 11, -4, 0.08, 7, "#8fa19d");
      return 15;
    case "residential":
      building(b, -4, 0, 8, 11, 5, f.color, "apartment", random);
      building(b, 5, 1, 7, 9, 4, "#c6d7c6", "heritage", random);
      return 16;
  }
}
