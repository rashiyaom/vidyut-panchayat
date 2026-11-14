import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
const target = resolve("demo/offline_bundle");
await mkdir(target, { recursive: true });
// Only this script's generated assets are replaced; authored demo artifacts stay.
for (const entry of await readdir(target, { withFileTypes: true }))
  if (entry.name === "assets")
    await rm(resolve(target, entry.name), { recursive: true });
await cp(resolve("dist"), target, { recursive: true });
console.log("Offline static bundle refreshed: " + target);
