import { chromium } from "@playwright/test";
import activeReplay from "../data/ml/browser_replay_v1.json";
import revisionAudit from "../experiments/ml/revision_audit_summary.json";
import weatherReplay from "../data/ml/weather_browser_replay_v1.json";
import gridTelemetry from "../data/processed/telemetry/pt_load_2014-09-15.json";

if (!revisionAudit.passAllCriteria ||
    activeReplay.policy.priorityBlend !== revisionAudit.frozenPolicy.priorityBlend ||
    activeReplay.policy.bufferMultiplier !== revisionAudit.frozenPolicy.bufferMultiplier)
  throw new Error("Bundled replay policy differs from the passing frozen audit");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader"],
});
const previewUrl = process.env.VIDYUT_PREVIEW_URL ?? process.env.PREVIEW_URL ?? "http://127.0.0.1:4174";
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(new URL("/?historical=1", previewUrl).toString());
  await page.locator("#enter-council").click();
  await page.waitForFunction(() => window.vidyutCity?.getSimulation().state === "AwaitingHuman", null, { timeout: 30000 });
  if (!(await page.locator(".historical-replay-badge").isVisible())) throw new Error("Historical badge missing");
  if (!(await page.locator(".historical-replay-badge").textContent())?.includes("passed 30-date simulation audit"))
    throw new Error("Revised audit status missing from replay badge");
  await page.locator('[data-room-tab="evidence"]').click();
  await page.locator("#technical-evidence>summary").click();
  await page.getByText("Trained model & historical evidence").click();
  if (!(await page.getByText("30 separate test days").isVisible())) throw new Error("ML evidence missing");
  if (!(await page.getByText("Revised policy · frozen audit passed", { exact: false }).isVisible()))
    throw new Error("Revised policy audit missing from evidence panel");
  if (weatherReplay.originPortugal.slice(0, 10) === activeReplay.origin.slice(0, 10) &&
      !(await page.getByText("Weather forecast for the same local date", { exact: false }).isVisible()))
    throw new Error("Weather forecast missing from historical evidence panel");
  if (!(await page.getByText(`Selected held-out date: ${activeReplay.origin.slice(0, 10)}`, { exact: false }).isVisible()))
    throw new Error("Selected model inference report missing");
  await page.getByText("Inspect selected date predictions and measured readings").click();
  if (!(await page.getByText(activeReplay.meterReadings[0].predictedKw.toFixed(2), { exact: true }).first().isVisible()))
    throw new Error("Saved model prediction missing");
  await page.evaluate(async () => {
    const plan = window.vidyutCity.getSimulation().plan!;
    await window.vidyutCity.command({ type: "APPROVE", planId: plan.id, hash: plan.hash });
    await window.vidyutCity.command({ type: "STEP" });
  });
  await page.waitForFunction(() => window.vidyutCity.getSimulation().tick?.t === 0);
  const firstDemand = await page.evaluate(() => window.vidyutCity.getSimulation().tick?.agents.find((a) => a.id === "hospital")?.demand);
  if (firstDemand !== activeReplay.actualDemand["0"].hospital) throw new Error("Replay demand differs from selected measured reading");
  if (gridTelemetry.originPortugal.slice(0, 10) === activeReplay.origin.slice(0, 10)) {
    const firstGridLoad = await page.evaluate(() => window.vidyutCity.getSimulation().tick?.gridLoad?.loadMw);
    if (firstGridLoad !== gridTelemetry.samples[0].loadMw) throw new Error("Replay national load differs from dated ENTSO-E extract");
  }
  if (errors.length) throw new Error(errors.join("; "));
  console.log("Historical replay opened, displayed model evidence, and executed its first held-out tick.");
} finally {
  await browser.close();
}
