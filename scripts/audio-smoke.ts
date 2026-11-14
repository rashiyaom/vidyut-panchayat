import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const audio = () => page.evaluate(() => window.vidyutCity.getAudio());
try {
  await page.goto(process.env.PREVIEW_URL ?? "http://127.0.0.1:4173/");
  await page.waitForFunction(() => !!window.vidyutCity);
  expect((await audio()).state).toBe("locked");
  await page.locator("#audio-settings").click();
  await page.waitForFunction(
    () => window.vidyutCity.getAudio().state === "running",
  );
  await page.waitForFunction(() =>
    window.vidyutCity.getAudio().recordings.includes("crowd"),
  );
  await page.locator("#audio-close").click();
  await page.evaluate(() => window.vidyutCity.focus("substation"));
  await page.waitForFunction(() =>
    window.vidyutCity
      .getAudio()
      .sources.some((s) => s.sound === "electric" && s.gain > 0.03),
  );
  const utility = await audio();
  await page.locator("#directory-toggle").click();
  await page.locator('[data-district="water"]').click();
  await page.waitForFunction(() =>
    window.vidyutCity.getAudio().recordings.includes("surf"),
  );
  await page.waitForFunction(() =>
    window.vidyutCity
      .getAudio()
      .sources.some((s) => s.sound === "surf" && s.gain > 0.03),
  );
  const beach = await audio();
  await page.locator("#pause").click();
  await page.waitForFunction(() =>
    window.vidyutCity
      .getAudio()
      .sources.filter((s) => ["train", "car", "bus", "steps"].includes(s.sound))
      .every((s) => s.gain < 0.01),
  );
  await page.locator("#pause").click();
  await page.locator("#enter-council").click();
  expect((await audio()).council).toBe(true);
  await page.locator("#audio-settings").click();
  await expect(page.locator("#audio-panel")).toBeVisible();
  await page.locator("#audio-close").click();
  await page.locator('[data-room-tab="impact"]').click();
  expect((await audio()).council).toBe(false);
  await page.locator('[data-room-tab="room"]').click();
  expect((await audio()).council).toBe(true);
  await page.locator("#leave-council").click();
  expect((await audio()).council).toBe(false);
  await page.locator("#audio-toggle").click();
  await page.waitForFunction(
    () => window.vidyutCity.getAudio().state === "suspended",
  );
  await page.reload();
  await page.waitForFunction(() => !!window.vidyutCity);
  expect((await audio()).settings.muted).toBe(true);
  expect((await audio()).state).toBe("locked");
  await page.locator("#audio-toggle").click();
  await page.waitForFunction(
    () => window.vidyutCity.getAudio().state === "running",
  );
  await page.locator("#audio-settings").click();
  await page.locator("#audio-fine-tune > summary").click();
  await page.locator("#audio-music").fill("0");
  expect((await audio()).settings.music).toBe(0);
  await mkdir("experiments/results", { recursive: true });
  await page.screenshot({ path: "experiments/results/audio-city.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#audio-panel")).toBeInViewport();
  await page.screenshot({ path: "experiments/results/audio-mobile.png" });
  await page.locator("#audio-close").click();
  await page.locator("#enter-council").click();
  await page.locator("#audio-settings").click();
  await expect(page.locator("#audio-panel")).toBeInViewport();
  await page.screenshot({
    path: "experiments/results/audio-council-mobile.png",
  });
  expect(errors).toEqual([]);
  await writeFile(
    "experiments/results/audio-smoke.json",
    JSON.stringify({ passed: true, utility, beach, errors }, null, 2),
  );
  console.log(
    "Audio browser checks passed: gesture unlock, local recordings, proximity, pause, council transitions, mixer, persistent mute, mobile controls.",
  );
} finally {
  await browser.close();
}
