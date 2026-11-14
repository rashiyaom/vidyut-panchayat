import { proximity } from "./soundDesign";
import type { SoundPoint } from "./soundDesign";

/** Selected places and nearby trains cannot lose their slot to a crowd of generic emitters. */
export function prioritizeSources<
  T extends { point: SoundPoint; gain: number },
>(sources: T[], selected?: string, limit = 18): T[] {
  const audible = sources
    .filter((s) => s.gain > 0.003)
    .sort((a, b) => b.gain - a.gain);
  const priority = audible.filter(
    (s) => s.point.id === selected || s.point.sound === "train",
  );
  const reserved = priority.slice(0, 3);
  return [...reserved, ...audible.filter((s) => !reserved.includes(s))].slice(
    0,
    limit,
  );
}
export function trainGain(distance: number, cameraDistance: number) {
  return (
    proximity(distance, 190) * Math.max(0.28, proximity(cameraDistance, 650))
  );
}
export function cueNormalization(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < data.length; i += 8) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / Math.ceil(data.length / 8));
  return Math.min(10, 0.19 / Math.max(0.02, rms));
}
