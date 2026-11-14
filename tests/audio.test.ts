import { describe, expect, it } from "vitest";
import {
  defaults,
  entitySound,
  makeSound,
  proximity,
  readSettings,
} from "../src/audio/soundDesign";
import { createCity } from "../src/world3d/city";
import { citySceneSchema } from "../src/world3d/sceneSchema";
import scene from "../data/scenes/city_v1.json";

describe("city sound design", () => {
  it("assigns a sound to every block and utility in the actual scene", () => {
    const city = createCity(citySceneSchema.parse(scene));
    for (const entity of city.entities)
      expect(entitySound(entity)).toBeTruthy();
    expect(
      entitySound(
        city.entities.find((e) => e.facility?.kind === "substation")!,
      ),
    ).toBe("electric");
    expect(
      entitySound(city.entities.find((e) => e.facility?.kind === "water")!),
    ).toBe("water");
    city.dispose();
  });
  it("keeps distance attenuation smooth, bounded and decreasing", () => {
    expect(proximity(0)).toBe(1);
    expect(proximity(115)).toBe(0);
    expect(proximity(500)).toBe(0);
    for (let d = 0; d < 115; d++)
      expect(proximity(d + 1)).toBeLessThanOrEqual(proximity(d));
    expect(Math.abs(proximity(114) - proximity(115))).toBeLessThan(0.001);
  });
  it("recovers from invalid saved settings and preserves mute and zero volume", () => {
    expect(readSettings("null")).toEqual(defaults);
    expect(readSettings("broken")).toEqual(defaults);
    expect(
      readSettings(
        '{"muted":true,"music":0,"master":40,"ui":-1,"ambience":"loud"}',
      ),
    ).toEqual({ ...defaults, muted: true, music: 0, master: 1, ui: 0 });
  });
  it("renders finite, non-silent, unclipped procedural buffers", () => {
    const context = {
      createBuffer: (_channels: number, length: number) => {
        const data = new Float32Array(length);
        return { getChannelData: () => data };
      },
    } as unknown as BaseAudioContext;
    for (const sound of [
      "music",
      "debate",
      "electric",
      "water",
      "surf",
      "crowd",
      "car",
      "bus",
      "train",
      "steps",
      "park",
      "hospital",
      "telecom",
      "emergency",
      "traffic",
      "transit",
      "fuel",
      "wind",
    ] as const) {
      const data = makeSound(context, sound).getChannelData(0);
      let power = 0,
        peak = 0,
        finite = true;
      for (const v of data) {
        finite &&= Number.isFinite(v);
        power += v * v;
        peak = Math.max(peak, Math.abs(v));
      }
      expect(finite).toBe(true);
      expect(Math.sqrt(power / data.length)).toBeGreaterThan(0.002);
      expect(peak).toBeLessThan(1);
    }
  });
});
