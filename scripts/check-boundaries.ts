import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(join(dir, e.name))
          : Promise.resolve([join(dir, e.name)]),
      ),
    )
  ).flat();
}
const errors: string[] = [];
for (const file of await files("src")) {
  if (!file.endsWith(".ts")) continue;
  const text = await readFile(file, "utf8");
  if (file.startsWith("src/engine/")) {
    if (
      /Math\.random\s*\(|Date\.now\s*\(|\b(document|window|Worker)\s*[.(]/.test(
        text,
      )
    )
      errors.push(`${file}: nondeterministic or browser dependency`);
    for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const path = relative(resolve("src"), resolve(file, "..", match[1]));
      if (!path.startsWith("engine/") && !path.startsWith("contract/"))
        errors.push(`${file}: forbidden import ${match[1]}`);
    }
  }
  if (
    /^src\/(app|world3d|ui|compare)\//.test(file) &&
    /from\s+['"][^'"]*engine\//.test(text)
  )
    errors.push(`${file}: direct engine import`);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Engine determinism and application/worker import boundaries pass.",
);
