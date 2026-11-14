import { z } from "zod";

export const facilityKinds = [
  "hospital",
  "water",
  "telecom",
  "emergency",
  "traffic",
  "shelter",
  "fuel",
  "transit",
  "residential",
  "commercial",
  "substation",
] as const;
export const transformSchema = z.object({
  offset: z.tuple([z.number(), z.number()]).default([0, 0]),
  rotation: z.number().default(0),
  scale: z.number().positive().default(1),
});
export type BlockTransform = z.infer<typeof transformSchema>;
export const facilitySchema = transformSchema.extend({
  id: z.string(),
  name: z.string(),
  kind: z.enum(facilityKinds),
  cell: z.tuple([z.number().int(), z.number().int()]),
  color: z.string(),
  description: z.string(),
  category: z.string(),
});
export const blockStyles = [
  "terraces",
  "courtyard",
  "villas",
  "townhouses",
  "lofts",
  "cylinder",
  "slabs",
  "hotel",
] as const;
export type BlockStyle = (typeof blockStyles)[number];
export const citySceneSchema = z
  .object({
    name: z.string(),
    seed: z.number().int(),
    gridSize: z.number().int().min(2).max(12),
    blockSize: z.number().positive(),
    roadWidth: z.number().positive(),
    districts: z.array(z.string()),
    facilities: z.array(facilitySchema),
    blockStyles: z.record(z.string(), z.enum(blockStyles)).default({}),
    blockTransforms: z.record(z.string(), transformSchema).default({}),
  })
  .superRefine((s, ctx) => {
    if (
      s.districts.length !== s.gridSize ||
      s.districts.some((r) => r.length !== s.gridSize || /[^RCP]/.test(r))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "District grid must match gridSize and contain only R, C or P.",
      });
    if (s.roadWidth >= s.blockSize / 2)
      ctx.addIssue({
        code: "custom",
        message: "Road width must leave room for buildings.",
      });
    for (const key of [
      ...Object.keys(s.blockStyles),
      ...Object.keys(s.blockTransforms),
    ]) {
      const cell = key.split(",").map(Number);
      if (!/^\d+,\d+$/.test(key) || cell.some((n) => n < 0 || n >= s.gridSize))
        ctx.addIssue({
          code: "custom",
          message:
            "Block override keys must be row,col coordinates inside the grid.",
        });
    }
    const ids = new Set<string>();
    const cells = new Set<string>();
    for (const f of s.facilities) {
      const key = f.cell.join(",");
      if (
        ids.has(f.id) ||
        cells.has(key) ||
        f.cell.some((n) => n < 0 || n >= s.gridSize)
      )
        ctx.addIssue({
          code: "custom",
          message: "Facility IDs and cells must be unique and inside the grid.",
        });
      ids.add(f.id);
      cells.add(key);
    }
  });
export type CityScene = z.infer<typeof citySceneSchema>;
export type Facility = z.infer<typeof facilitySchema>;
export type FacilityKind = Facility["kind"];

export function seededRandom(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
