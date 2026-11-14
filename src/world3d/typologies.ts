import { CityBatch, tree, bench, palm } from "./primitives";
import { building } from "./buildings";
import type { BlockStyle } from "./sceneSchema";

const stone = ["#d6d1bc", "#b7c1ba", "#d1c3aa", "#adb9bd", "#d9dbce"];

function planter(
  b: CityBatch,
  x: number,
  y: number,
  z: number,
  w = 2.6,
  d = 1,
) {
  b.box(x, y, z, w, 0.5, d, "#b7b6a3");
  b.box(x, y + 0.32, z, w - 0.18, 0.3, d - 0.18, "#647f49");
  for (let i = 0; i < 3; i++)
    b.sphere(
      x + (i - 1) * w * 0.26,
      y + 0.52,
      z,
      w * 0.19,
      0.35,
      d * 0.47,
      i % 2 ? "#7a9258" : "#496d4b",
    );
}
function rooftop(
  b: CityBatch,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
) {
  b.box(x, y, z, w, 0.24, d, "#d8d5c4");
  b.box(x, y + 0.14, z, w - 0.6, 0.08, d - 0.6, "#6f7876");
  for (const side of [-1, 1]) {
    b.box(x, y + 0.38, z + (side * d) / 2, w, 0.65, 0.18, "#d7d8cc");
    b.box(x + (side * w) / 2, y + 0.38, z, 0.18, 0.65, d, "#d7d8cc");
  }
  for (let k = 0; k < 3; k++)
    b.box(
      x - w * 0.25,
      y + 0.35,
      z - d * 0.25 + k * 0.9,
      w * 0.28,
      0.12,
      0.72,
      "#335b68",
      0,
      "glass",
    );
  b.box(x + w * 0.2, y + 0.6, z - d * 0.2, 1.6, 1, 1.8, "#b7c1bd");
  b.cylinder(x + w * 0.2, y + 1.12, z - d * 0.2, 0.53, 0.08, "#778584");
}
function garden(b: CityBatch) {
  for (const x of [-8.7, 8.7]) {
    tree(b, x, 7.7, 0.75, x < 0 ? 1 : 3);
    planter(b, x, 0.55, -8, 1.2, 3);
  }
  bench(b, 2, 8.8);
}

/** Different silhouettes and site plans, each built in reusable local coordinates. */
export function neighborhood(
  b: CityBatch,
  style: BlockStyle,
  rng: () => number,
) {
  const c = stone[Math.floor(rng() * stone.length)];
  switch (style) {
    case "terraces": {
      const tiers = 3 + Math.floor(rng() * 2),
        base = 1.1;
      b.box(0, 0.5, 0, 18, 0.3, 18, "#c7c5b2");
      for (let t = 0; t < tiers; t++) {
        const w = 16 - t * 2.8,
          d = 13 - t * 1.7,
          z = -t * 0.7,
          y = base + t * 4.8;
        b.box(0, y + 2.3, z, w, 4.6, d, c);
        for (const side of [-1, 1]) {
          b.box(
            0,
            y + 2.4,
            z + side * (d / 2 + 0.02),
            w - 0.8,
            3,
            0.06,
            "#487883",
            0,
            "glass",
          );
          for (let x = -w / 2 + 0.7; x < w / 2; x += 1.65)
            b.box(
              x,
              y + 2.4,
              z + side * (d / 2 + 0.08),
              0.12,
              3.4,
              0.14,
              "#dadbce",
            );
          b.box(
            0,
            y + 4.63,
            z + side * (d / 2 + 0.4),
            w + 1,
            0.2,
            1.4,
            "#e2ded0",
          );
          b.box(
            0,
            y + 5,
            z + side * (d / 2 + 1),
            w + 0.8,
            0.65,
            0.07,
            "#85a5a4",
            0,
            "glass",
          );
          for (const x of [-w * 0.32, w * 0.32])
            planter(b, x, y + 4.92, z + side * (d / 2 + 0.25), 2.1, 0.7);
        }
        for (const side of [-1, 1])
          b.box(
            side * (w / 2 + 0.03),
            y + 2.5,
            z,
            0.07,
            3,
            d - 1,
            "#64878b",
            0,
            "glass",
          );
        rooftop(b, 0, y + 4.8, z, w, d);
      }
      garden(b);
      return {
        height: tiers * 4.8 + 2.6,
        name: "The Terraces",
        description:
          "Stepped residences with planted balconies, rooftop solar and generous outdoor rooms.",
      };
    }
    case "courtyard": {
      const floors = 4 + Math.floor(rng() * 3);
      const h = floors * 2.35 + 3.6;
      building(b, -5.8, -0.5, 5, 15, floors, c, "apartment", rng);
      building(b, 5.8, -0.5, 5, 15, floors + 1, "#c8b9a1", "apartment", rng);
      building(b, 0, -6.5, 7, 4, floors - 1, c, "office", rng);
      b.box(0, 0.44, 1.6, 6, 0.12, 10, "#7b9659");
      b.box(0, 0.53, 3.5, 1.4, 0.05, 12, "#e4dac2");
      tree(b, -1.5, 1, 0.85, 2);
      tree(b, 1.6, -2, 1, 3);
      for (let y = 3; y < h - 3; y += 2.35) {
        b.box(-3, y, -0.4, 0.9, 0.15, 13.5, "#e0d9c6");
        b.box(-2.5, y + 0.45, -0.4, 0.08, 0.8, 13.5, "#739291", 0, "glass");
      }
      for (let x = -2.5; x < 3; x += 0.6)
        b.box(x, 2.7, 6, 0.12, 0.15, 3, "#8a7254");
      for (const x of [-2.5, 2.5]) b.box(x, 1.6, 7, 0.16, 2.5, 0.16, "#807962");
      return {
        height: h + 2.4,
        name: "Courtyard House",
        description:
          "Two residential wings frame a shaded garden, shared pergola and pedestrian courtyard.",
      };
    }
    case "villas": {
      b.box(0, 0.43, 0, 19, 0.15, 19, "#91a56c");
      for (const side of [-1, 1]) {
        const x = side * 5;
        b.box(x, 1.95, -3, 7.4, 3.2, 8.2, "#ddd6c4");
        b.box(x - side * 1.2, 4.6, -4, 5, 2.4, 5.7, "#c1b8a4");
        b.box(x, 3.62, -2.7, 7.9, 0.22, 9.2, "#f0e9d8");
        b.box(x - side * 1.2, 5.94, -4, 5.5, 0.23, 6.2, "#ece5d2");
        b.box(x, 1.95, 1.15, 6.5, 2.3, 0.08, "#456e77", 0, "glass");
        b.box(
          x - side * 1.2,
          4.6,
          -1.12,
          4.2,
          1.7,
          0.07,
          "#527c82",
          0,
          "glass",
        );
        for (let i = 0; i < 8; i++)
          b.box(
            x - side * 2.7 + i * 0.15,
            2.1,
            1.28,
            0.06,
            2.6,
            0.16,
            "#9c825a",
          );
        b.box(x, 0.55, 4.8, 6.8, 0.2, 5, "#d5c4a3");
        b.box(x, 0.66, 5.5, 4.5, 0.1, 2.6, "#4eafb5", 0, "glass");
        for (const dx of [-2.8, 2.8])
          b.box(x + dx, 0.7, 4.6, 0.8, 0.15, 1.8, "#eee3ca");
        planter(b, x, 6.18, -5, 3, 0.7);
      }
      palm(b, -8.5, 7.5, 0.72);
      tree(b, 8.4, -8, 0.8, 3);
      b.box(0, 0.53, 0, 1.2, 0.08, 19, "#d6d2be");
      return {
        height: 7,
        name: "Palm Villas",
        description:
          "Modern garden homes with shaded glazing, private pools and a quiet pedestrian lane.",
      };
    }
    case "townhouses": {
      const palette = ["#c8b492", "#c7cebf", "#a4b5b6", "#b89d88"];
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 5.7,
            z = side * 5.1,
            floors = 2 + Math.floor(rng() * 2);
          building(
            b,
            x,
            z,
            4.8,
            6.2,
            floors,
            palette[(i + (side > 0 ? 1 : 0)) % 4],
            "heritage",
            rng,
          );
          b.box(x, 0.45, z - side * 4, 4.4, 0.12, 1.2, "#819967");
          planter(b, x, 0.65, z - side * 3.5, 2.5, 0.45);
        }
      tree(b, -8.5, 0, 0.7);
      tree(b, 8.5, 0, 0.7, 3);
      return {
        height: 11.6,
        name: "Mews & Market",
        description:
          "Narrow townhouses with slate roofs, independent storefronts and planted front gardens.",
      };
    }
    case "lofts": {
      const h = 10.8;
      for (const x of [-4.7, 4.7]) {
        b.box(x, h / 2 + 0.35, -1, 7.7, h, 15, "#937567");
        for (let f = 0; f < 4; f++)
          for (let i = 0; i < 4; i++)
            for (const side of [-1, 1]) {
              const z = -6.4 + i * 3.4;
              b.box(
                x + side * 3.87,
                1.8 + f * 2.5,
                z,
                0.08,
                1.8,
                2.3,
                "#52767b",
                0,
                "glass",
              );
              b.box(
                x + side * 3.94,
                1.8 + f * 2.5,
                z,
                0.1,
                1.85,
                0.08,
                "#c5b8a1",
              );
            }
        for (let f = 0; f < 4; f++)
          for (let i = 0; i < 3; i++) {
            b.box(
              x + (i - 1) * 2.25,
              1.8 + f * 2.5,
              6.55,
              1.65,
              1.8,
              0.08,
              "#50747a",
              0,
              "glass",
            );
            b.box(
              x + (i - 1) * 2.25,
              1.8 + f * 2.5,
              6.61,
              0.07,
              1.85,
              0.1,
              "#cabba4",
            );
          }
        for (let f = 0; f < 5; f++)
          b.box(x, 0.65 + f * 2.5, -1, 8, 0.18, 15.2, "#c3b6a0");
        rooftop(b, x, h + 0.4, -1, 8, 15.4);
        for (let n = 0; n < 3; n++)
          b.add(
            "roof",
            x,
            h + 1.2,
            -5 + n * 4.3,
            5,
            1.2,
            2.8,
            "#719197",
            0,
            "glass",
          );
      }
      b.box(0, 0.5, -1, 1.5, 0.12, 17, "#d6cdb6");
      tree(b, 0, 6, 0.8, 2);
      bench(b, 0, -5, Math.PI / 2);
      return {
        height: h + 2,
        name: "Foundry Lofts",
        description:
          "Converted brick workshops with tall factory windows, glazed rooflights and a landscaped lane.",
      };
    }
    case "cylinder": {
      const floors = 11 + Math.floor(rng() * 7),
        h = floors * 2.25;
      building(b, 0, 1, 15, 13, 2, "#b9beb7", "office", rng);
      b.add("cylinder", -1, h / 2 + 5, -1, 5.5, h, 5.5, "#497a88", 0, "glass");
      for (let i = 0; i <= floors; i++)
        b.cylinder(-1, 5 + i * 2.25, -1, 5.62, 0.18, "#c3d1cd");
      for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI) / 10;
        b.box(
          -1 + Math.sin(a) * 5.53,
          h / 2 + 5,
          -1 + Math.cos(a) * 5.53,
          0.105,
          h,
          0.105,
          "#9cb1b2",
          a,
        );
      }
      b.cylinder(-1, h + 5.3, -1, 5.7, 0.4, "#d0d7d0");
      b.cylinder(-1, h + 5.75, -1, 4.8, 0.5, "#657a7b");
      b.cylinder(-1, h + 6.5, -1, 2.5, 1, "#9eafaa");
      b.cylinder(-1, h + 8, -1, 0.08, 3, "#c3cbc6");
      garden(b);
      return {
        height: h + 10,
        name: "Meridian Tower",
        description:
          "A curved glass tower rising from a retail podium, with a distinctive circular crown.",
      };
    }
    case "slabs": {
      const floors = 8 + Math.floor(rng() * 7),
        h = floors * 2.55;
      b.box(0, 2, 0, 16, 3.5, 15, "#bdc5be");
      for (const side of [-1, 1]) {
        const x = side * 4.3,
          yh = h + (side > 0 ? 6 : 0),
          z = side * 2;
        b.box(x, 3.9 + yh / 2, z, 5.7, yh, 11, "#446e7c", 0, "glass");
        for (let y = 5.9; y < yh + 3.9; y += 2.55)
          b.box(x, y, z, 5.9, 0.16, 11.2, "#a7baba");
        for (const dx of [-2.9, 2.9])
          b.box(x + dx, 3.9 + yh / 2, z, 0.24, yh + 0.5, 11.3, "#c9cfc5");
        for (let n = 0; n < 6; n++)
          for (const sideZ of [-1, 1])
            b.box(
              x - 2.2 + n * 0.88,
              3.9 + yh / 2,
              z + sideZ * 5.55,
              0.06,
              yh,
              0.07,
              "#6a969e",
            );
        rooftop(b, x, yh + 3.9, z, 6.1, 11.5);
      }
      b.box(0, 10, 0, 4, 2.3, 2.6, "#759a9c", 0, "glass");
      garden(b);
      return {
        height: h + 12,
        name: "Eastbank Exchange",
        description:
          "Offset glass office towers joined by a skybridge, with vertical stone fins and a shared podium.",
      };
    }
    case "hotel": {
      const h = 22 + rng() * 9;
      b.box(-1, 1.5, -1, 17, 2.5, 16, "#c1b9a7");
      for (let i = 0; i < Math.floor(h / 2.8); i++) {
        const y = 4 + i * 2.8,
          w = 13 - i * 0.45,
          z = -i * 0.3;
        b.box(-1, y, z, w, 2.65, 9, "#b9c5bc");
        b.box(
          -1,
          y + 0.15,
          z + 4.56,
          w - 0.8,
          1.85,
          0.08,
          "#517e85",
          0,
          "glass",
        );
        for (let x = -w / 2; x < w / 2; x += 1.8)
          b.box(x - 1, y + 0.15, z + 4.7, 0.13, 2, 0.2, "#d4d5c5");
        b.box(-1, y + 1.35, z, w + 1, 0.18, 10.3, "#e1ddce");
        b.box(-1, y + 1.7, z + 5.1, w + 1, 0.6, 0.08, "#83a4a0", 0, "glass");
        planter(b, -1 + w * 0.33, y + 1.66, z + 4.5, 2, 0.7);
      }
      b.box(5, 0.52, 6.5, 6, 0.1, 3, "#4fabb2", 0, "glass");
      palm(b, 8, 8, 0.9);
      palm(b, -8, 7, 0.85, 0.4);
      return {
        height: h + 3,
        name: "Coastline Hotel",
        description:
          "A terraced coastal hotel with deep balconies, a pool terrace and palm-lined arrival court.",
      };
    }
  }
}

export function chooseStyle(
  row: number,
  col: number,
  commercial: boolean,
  random: () => number,
): BlockStyle {
  const styles: BlockStyle[] = commercial
    ? ["cylinder", "slabs", "hotel", "terraces"]
    : [
        "courtyard",
        "villas",
        "terraces",
        "townhouses",
        "lofts",
        "courtyard",
        "villas",
      ];
  return styles[(row * 3 + col * 2 + Math.floor(random() * 3)) % styles.length];
}
