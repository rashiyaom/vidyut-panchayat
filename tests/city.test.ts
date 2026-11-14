import { describe, expect, it } from "vitest";
import layout from "../data/scenes/city_v1.json";
import {
  blockStyles,
  citySceneSchema,
  seededRandom,
} from "../src/world3d/sceneSchema";
import { createCity } from "../src/world3d/city";
import { roundedRoute, sampleRoute } from "../src/world3d/mobility";

describe("city configuration boundaries", () => {
  it("rejects duplicate facility cells and malformed district grids", () => {
    const duplicate = structuredClone(layout);
    duplicate.facilities[1].cell = duplicate.facilities[0].cell;
    expect(() => citySceneSchema.parse(duplicate)).toThrow();
    expect(() =>
      citySceneSchema.parse({ ...layout, districts: ["R"] }),
    ).toThrow();
  });
  it("rejects out-of-grid facilities and nonpositive scales", () => {
    const invalid = citySceneSchema.parse(layout);
    invalid.facilities[0].cell = [99, 0];
    expect(() => citySceneSchema.parse(invalid)).toThrow();
    invalid.facilities[0].cell = [3, 4];
    invalid.facilities[0].scale = 0;
    expect(() => citySceneSchema.parse(invalid)).toThrow();
  });
  it("validates architectural overrides at the data boundary", () => {
    expect(() =>
      citySceneSchema.parse({ ...layout, blockStyles: { "99,0": "villas" } }),
    ).toThrow();
    expect(() =>
      citySceneSchema.parse({ ...layout, blockStyles: { "0,0": "unknown" } }),
    ).toThrow();
    expect(() =>
      citySceneSchema.parse({
        ...layout,
        blockTransforms: { "0,0": { scale: 0 } },
      }),
    ).toThrow();
  });
  it("produces repeatable random details without global randomness", () => {
    const a = seededRandom(42),
      b = seededRandom(42),
      c = seededRandom(43);
    const first = Array.from({ length: 20 }, a);
    expect(first).toEqual(Array.from({ length: 20 }, b));
    expect(first).not.toEqual(Array.from({ length: 20 }, c));
  });
});
describe("reusable city geometry", () => {
  it("supports every typology and preserves generated-block transforms across rebuilds", () => {
    const config = citySceneSchema.parse(layout);
    const cells = [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [0, 6],
      [0, 7],
    ];
    cells.forEach(
      (cell, i) => (config.blockStyles[cell.join(",")] = blockStyles[i]),
    );
    config.blockTransforms["0,0"] = {
      offset: [2, -3],
      rotation: Math.PI / 4,
      scale: 0.85,
    };
    const city = createCity(config);
    const e = city.entities.find((e) => e.id === "block-0-0")!;
    expect(e.name).toBe("The Terraces");
    expect(e.position.x).toBe(-96);
    expect(e.position.z).toBe(-101);
    expect(e.scale).toBe(0.85);
    expect(e.rotation).toBe(Math.PI / 4);
    const names = cells.map(
      ([row, col]) =>
        city.entities.find((e) => e.id === `block-${row}-${col}`)!.name,
    );
    expect(new Set(names).size).toBe(8);
    expect(
      city.entities.every((e) => Number.isFinite(e.height) && e.height > 0),
    ).toBe(true);
    city.dispose();
  });
  it("repositions and scales a facility from data while preserving its identity", () => {
    const base = citySceneSchema.parse(layout),
      before = createCity(base);
    const changed = structuredClone(base);
    changed.facilities[0].offset = [3, -2];
    changed.facilities[0].scale = 1.15;
    changed.facilities[0].rotation = Math.PI / 2;
    const after = createCity(changed);
    const old = before.entities.find((e) => e.id === "hospital")!,
      next = after.entities.find((e) => e.id === "hospital")!;
    expect(after.entities).toHaveLength(64);
    expect(next.position.x - old.position.x).toBe(3);
    expect(next.position.z - old.position.z).toBe(-2);
    expect(next.height).toBeCloseTo(old.height * 1.15);
    expect(next.rotation).toBe(Math.PI / 2);
    before.dispose();
    after.dispose();
  });
  it("keeps a car loop in road lanes and closes it continuously", () => {
    const route = roundedRoute(1.65, 1.65, 26.35, 26.35, 2.6);
    for (let i = 0; i < 500; i++) {
      const p = sampleRoute(route, i / 500);
      expect(p.x < 3.4 || p.x > 24.6 || p.z < 3.4 || p.z > 24.6).toBe(true);
    }
    const start = sampleRoute(route, 0),
      end = sampleRoute(route, 1 - 1e-6);
    expect(Math.hypot(start.x - end.x, start.z - end.z)).toBeLessThan(0.001);
  });
});
