import { expect, it } from "vitest";
import {
  prioritizeSources,
  trainGain,
  cueNormalization,
} from "../src/audio/audioMix";
import type { SoundPoint } from "../src/audio/soundDesign";
it("reserves audible trains and the selected building under voice pressure", () => {
  const sources = Array.from({ length: 40 }, (_, i) => ({
    point: {
      id: `car-${i}`,
      sound: "car",
      x: 0,
      y: 0,
      z: 0,
      level: 1,
    } as SoundPoint,
    gain: 0.9,
  }));
  sources.push(
    {
      point: { id: "train", sound: "train", x: 0, y: 0, z: 0, level: 1 },
      gain: 0.11,
    },
    {
      point: { id: "water", sound: "water", x: 0, y: 0, z: 0, level: 1 },
      gain: 0.05,
    },
  );
  const mixed = prioritizeSources(sources, "water");
  expect(mixed).toHaveLength(18);
  expect(mixed.map((s) => s.point.id)).toContain("train");
  expect(mixed.map((s) => s.point.id)).toContain("water");
});
it("retains a train at ordinary overview distances but fades remote trains", () => {
  expect(trainGain(50, 400)).toBeGreaterThan(0.1);
  expect(trainGain(200, 60)).toBe(0);
  expect(trainGain(30, 60)).toBeGreaterThan(trainGain(100, 60));
});
it("normalizes quiet inspection cues with bounded amplification", () => {
  const buffer = {
    getChannelData: () => new Float32Array(100).fill(0.025),
  } as unknown as AudioBuffer;
  expect(cueNormalization(buffer)).toBeCloseTo(7.6);
  expect(
    cueNormalization({
      getChannelData: () => new Float32Array(100),
    } as unknown as AudioBuffer),
  ).toBeLessThanOrEqual(10);
});
