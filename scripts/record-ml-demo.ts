import { chromium } from "@playwright/test";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import activeReplay from "../data/ml/browser_replay_v1.json";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader"],
});
await mkdir("docs/assets", { recursive: true });
const recordingDir = await mkdtemp(join(tmpdir(), "vidyut-ml-demo-"));
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: recordingDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
try {
  await page.goto("http://127.0.0.1:4173/?historical=1");
  await page.locator("#enter-council").click();
  await page.waitForFunction(() => window.vidyutCity?.getSimulation().state === "AwaitingHuman", null, { timeout: 30000 });
  await page.locator('[data-room-tab="evidence"]').click();
  await page.locator("#technical-evidence>summary").click();
  await page.getByText("Trained model & historical evidence").click();
  await page.locator(".ml-evidence table").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(2200);
  await page.getByText("Inspect selected date predictions and measured readings").click();
  await page.getByText("Selected date MAE, kW").scrollIntoViewIfNeeded();
  await page.waitForTimeout(2200);
  await page.getByText("Inspect selected date predictions and measured readings").click();
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const plan = window.vidyutCity.getSimulation().plan!;
    await window.vidyutCity.command({ type: "APPROVE", planId: plan.id, hash: plan.hash });
    await window.vidyutCity.command({ type: "STEP" });
  });
  await page.waitForFunction(() => window.vidyutCity.getSimulation().tick?.t === 0);
  await page.locator("#sim-metrics").scrollIntoViewIfNeeded();
  await page.waitForTimeout(2200);
  if (activeReplay.origin.slice(0, 10) !== await page.locator(".historical-replay-badge").textContent().then((s) => s?.match(/\d{4}-\d{2}-\d{2}/)?.[0]))
    throw new Error("Video date differs from the active inference report");
} finally {
  const video = page.video();
  await context.close();
  if (video) await copyFile(await video.path(), "docs/assets/ml-demo.webm");
  await browser.close();
  await rm(recordingDir, { recursive: true, force: true });
}
console.log(`Recorded docs/assets/ml-demo.webm for ${activeReplay.origin.slice(0, 10)}.`);
