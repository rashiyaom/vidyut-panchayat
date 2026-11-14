import * as THREE from "three";
import { CityBatch, tree } from "./primitives";
import { facility } from "./buildings";
import { groundAndRoads, park, createWater, civicPlaza } from "./environment";
import { neighborhood, chooseStyle } from "./typologies";
import { createBeachfront } from "./beachfront";
import { createCoast } from "./coast";
import { seededRandom } from "./sceneSchema";
import type { Tick } from "../contract/types";
import type { CityScene, Facility } from "./sceneSchema";

export interface CityEntity {
  id: string;
  name: string;
  category: string;
  description: string;
  position: THREE.Vector3;
  height: number;
  rotation: number;
  scale: number;
  bounds: THREE.Box3;
  facility?: Facility;
}
export function createCity(config: CityScene) {
  const group = new THREE.Group(),
    b = new CityBatch(),
    entities: CityEntity[] = [];
  groundAndRoads(b, config);
  const half = (config.gridSize * config.blockSize) / 2;
  for (let row = 0; row < config.gridSize; row++)
    for (let col = 0; col < config.gridSize; col++) {
      const rng = seededRandom(config.seed + row * 2197 + col * 31),
        f = config.facilities.find(
          (f) => f.cell[0] === row && f.cell[1] === col,
        );
      const transform = f ?? config.blockTransforms[`${row},${col}`];
      const x =
          -half + (col + 0.5) * config.blockSize + (transform?.offset[0] ?? 0),
        z =
          -half + (row + 0.5) * config.blockSize + (transform?.offset[1] ?? 0);
      b.setTransform(x, z, transform?.rotation ?? 0, transform?.scale ?? 1);
      let h = 5,
        blockName: string | undefined,
        blockDescription: string | undefined;
      const district = config.districts[row][col];
      if (f) {
        b.setOwner(f.id);
        h = facility(b, f, rng);
        b.setOwner();
        for (const dx of [-8, 8]) tree(b, dx, 8, 0.7, col);
      } else if (district === "P") {
        if (row === 3 && col === 3) {
          civicPlaza(b);
          h = 18;
        } else
          park(
            b,
            0,
            0,
            config.blockSize - config.roadWidth - 2,
            rng,
            (row + col) % 3 === 0,
          );
      } else {
        const style =
          config.blockStyles[`${row},${col}`] ??
          chooseStyle(row, col, district === "C", rng);
        const result = neighborhood(b, style, rng);
        h = result.height;
        blockName = result.name;
        blockDescription = result.description;
      }

      const scale = transform?.scale ?? 1;
      const rotation = transform?.rotation ?? 0;
      const radius =
        (config.blockSize - config.roadWidth) *
        0.5 *
        scale *
        (Math.abs(Math.cos(rotation)) + Math.abs(Math.sin(rotation)));
      entities.push({
        id: f?.id ?? "block-" + row + "-" + col,
        name:
          f?.name ??
          blockName ??
          (district === "P"
            ? row === 3 && col === 3
              ? "Panchayat Square"
              : "Neighborhood Gardens"
            : district === "C"
              ? "Eastbank Offices"
              : "Garden Residences"),
        category:
          f?.category ??
          (district === "P"
            ? "Public park"
            : district === "C"
              ? "Commercial"
              : "Residential"),
        description:
          f?.description ??
          blockDescription ??
          (district === "P"
            ? row === 3 && col === 3
              ? "Nagar’s civic heart: a grand domed Panchayat hall, colonnaded entrance, formal gardens and fountain court."
              : "A leafy neighborhood park with walking paths and places to gather."
            : "A mixed-use city block with local shops, planted courtyards and homes above the street."),
        position: new THREE.Vector3(x, 0, z),
        height: h * scale,
        scale,
        rotation: transform?.rotation ?? 0,
        facility: f,
        bounds: new THREE.Box3(
          new THREE.Vector3(x - radius, 0, z - radius),
          new THREE.Vector3(x + radius, h * scale, z + radius),
        ),
      });
    }
  b.setTransform(0, 0);
  const coast = createCoast(b, config);
  const beachfront = createBeachfront(b, config);
  group.add(b.finish(), coast, beachfront.group);
  const water = createWater(config);
  group.add(water.mesh);
  return {
    group,
    entities,
    water,
    update: beachfront.update,
    resetService() {
      for (const f of config.facilities) b.setService(f.id, 1);
    },
    applyTick(tick: Tick) {
      for (const agent of tick.agents) b.setService(agent.id, agent.service);
    },
    dispose() {
      const gs = new Set<THREE.BufferGeometry>(),
        ms = new Set<THREE.Material>();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          gs.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            ms.add(m),
          );
        }
      });
      gs.forEach((g) => g.dispose());
      ms.forEach((m) => m.dispose());
      group.removeFromParent();
    },
  };
}
