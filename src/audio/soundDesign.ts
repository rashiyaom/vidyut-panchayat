import type { CityEntity } from "../world3d/city";

export type Sound =
  | "crowd"
  | "water"
  | "electric"
  | "hospital"
  | "telecom"
  | "emergency"
  | "traffic"
  | "fuel"
  | "transit"
  | "park"
  | "surf"
  | "car"
  | "bus"
  | "train"
  | "steps"
  | "wind";
export interface SoundPoint {
  id: string;
  sound: Sound;
  x: number;
  y: number;
  z: number;
  level: number;
  moving?: boolean;
}
export interface MixSettings {
  muted: boolean;
  master: number;
  music: number;
  ambience: number;
  ui: number;
}
export const defaults: MixSettings = {
  muted: false,
  master: 0.65,
  music: 0.45,
  ambience: 0.7,
  ui: 0.45,
};
export function readSettings(value: string | null): MixSettings {
  try {
    const parsed = JSON.parse(value ?? "{}");
    const result = { ...defaults };
    for (const key of ["master", "music", "ambience", "ui"] as const)
      if (typeof parsed[key] === "number" && Number.isFinite(parsed[key]))
        result[key] = Math.min(1, Math.max(0, parsed[key]));
    if (typeof parsed.muted === "boolean") result.muted = parsed.muted;
    return result;
  } catch {
    return { ...defaults };
  }
}
export function entitySound(
  entity: Pick<CityEntity, "facility" | "category" | "id">,
): Sound {
  const kind = entity.facility?.kind;
  if (kind === "substation") return "electric";
  if (kind === "residential" || kind === "commercial" || kind === "shelter")
    return "crowd";
  if (kind) return kind;
  return entity.id === "block-3-3"
    ? "crowd"
    : entity.category === "Public park"
      ? "park"
      : "crowd";
}
/** Smooth, bounded falloff in city units. Overview remains quiet. */
export function proximity(distance: number, radius = 115): number {
  const t = Math.min(1, Math.max(0, 1 - distance / radius));
  return t * t * (3 - 2 * t);
}

/** Original procedural foley. All loops use periodic envelopes and a short seam blend. */
export function makeSound(
  context: BaseAudioContext,
  sound: Sound | "music" | "debate",
): AudioBuffer {
  const rate = 22050,
    duration = sound === "music" || sound === "debate" ? 32 : 8;
  const buffer = context.createBuffer(1, duration * rate, rate),
    data = buffer.getChannelData(0);
  let seed = 7103,
    brown = 0,
    low = 0;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 2147483648 - 1;
  };
  const sine = (f: number, t: number) => Math.sin(2 * Math.PI * f * t);
  for (let i = 0; i < data.length; i++) {
    const t = i / rate,
      n = noise();
    brown = (brown + 0.025 * n) / 1.025;
    low += 0.13 * (n - low);
    let v = 0;
    switch (sound) {
      case "music":
      case "debate": {
        const chords =
          sound === "music"
            ? [
                [130.81, 164.81, 196, 246.94],
                [110, 130.81, 164.81, 196],
                [87.31, 130.81, 174.61, 220],
                [98, 146.83, 196, 246.94],
              ]
            : [
                [110, 130.81, 164.81, 220],
                [98, 123.47, 146.83, 196],
                [87.31, 110, 130.81, 174.61],
                [98, 110, 146.83, 196],
              ];
        // Crossfade adjacent chords with raised cosines; muted bell notes above a warm pad.
        const chord = Math.floor(t / 8),
          phase = (t % 8) / 8;
        for (let c = 0; c < 2; c++) {
          const weight = c
            ? (1 - Math.cos(phase * Math.PI)) / 2
            : (1 + Math.cos(phase * Math.PI)) / 2;
          for (const f of chords[(chord + c) % 4])
            v += weight * (sine(f, t) + 0.15 * sine(f * 2, t)) * 0.035;
        }
        const beat = sound === "music" ? 2 : 0.75,
          p = t % beat;
        const note = chords[chord][Math.floor(t / beat) % 4] * 2;
        v += sine(note, t) * Math.exp(-p * 2.4) * Math.min(1, p * 35) * 0.06;
        if (sound === "debate")
          v += sine(55, t) * Math.exp(-p * 10) * Math.min(1, p * 60) * 0.07;
        break;
      }
      case "electric":
        v = 0.11 * sine(100, t) + 0.035 * sine(200, t) + low * 0.07;
        break;
      case "water":
        v = low * 0.8 + brown * 0.6 + sine(620 + 90 * sine(1, t), t) * 0.012;
        break;
      case "surf":
        v = (low * 0.7 + brown) * (0.5 + 0.45 * sine(0.125, t));
        break;
      case "wind":
        v = brown * (0.5 + 0.2 * sine(0.25, t));
        break;
      case "car":
      case "bus":
      case "fuel":
        v =
          brown * 0.6 +
          0.065 *
            sine(sound === "car" ? 75 : 50, t) *
            (0.8 + 0.2 * sine(12, t)) +
          low * 0.08;
        break;
      case "train":
        v =
          brown * 0.9 +
          low * 0.25 +
          0.04 * sine(180, t) +
          n * 0.18 * Math.exp(-(t % 0.36) * 60);
        break;
      case "steps":
        v =
          low * 0.7 * Math.exp(-(t % 0.48) * 40) +
          sine(140, t) * 0.1 * Math.exp(-(t % 0.48) * 55);
        break;
      case "park":
        v =
          brown * 0.3 +
          0.05 *
            sine(2400 + 300 * sine(5, t), t) *
            Math.pow(Math.max(0, sine(0.5, t)), 18);
        break;
      case "hospital":
        v =
          brown * 0.25 +
          sine(880, t) * 0.025 * Math.pow(Math.max(0, sine(0.5, t)), 48);
        break;
      case "telecom":
        v =
          low * 0.2 +
          sine(620, t) * 0.025 * Math.pow(Math.max(0, sine(2, t)), 32);
        break;
      case "emergency":
        v = brown * 0.4 + sine(240, t) * 0.025;
        break;
      case "traffic":
        v = brown * 0.8 + low * 0.15;
        break;
      case "transit":
        v = brown * 0.5 + low * 0.15 + sine(330, t) * 0.02;
        break;
      // A quiet air bed while the locally bundled human recording decodes.
      case "crowd":
        v = brown * 0.35;
        break;
    }
    data[i] = v;
  }
  const seam = Math.floor(rate * 0.08);
  for (let i = 0; i < seam; i++) {
    const weight = i / seam;
    data[data.length - seam + i] =
      data[data.length - seam + i] * (1 - weight) + data[i] * weight;
  }
  return buffer;
}
