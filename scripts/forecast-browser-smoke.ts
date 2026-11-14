import { chromium } from "@playwright/test";
import activeReplay from "../data/ml/browser_replay_v1.json";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4173/?historical=1");
  await page.locator("#enter-council").click();
  await page.waitForFunction(() => window.vidyutCity?.getSimulation().state === "AwaitingHuman", null, { timeout: 30000 });
  if (!(await page.locator(".historical-replay-badge").isVisible())) throw new Error("Historical badge missing");
  if (!(await page.locator(".historical-replay-badge").textContent())?.includes("fairness gate missed"))
    throw new Error("Experimental policy limitation missing from replay badge");
  await page.locator('[data-room-tab="evidence"]').click();
  await page.locator("#technical-evidence>summary").click();
  await page.getByText("Trained model & historical evidence").click();
  if (!(await page.getByText("30 separate test days").isVisible())) throw new Error("ML evidence missing");
  if (!(await page.getByText("Fresh policy audit · experimental", { exact: false }).isVisible()))
    throw new Error("Fresh policy audit missing from evidence panel");
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
  if (errors.length) throw new Error(errors.join("; "));
  console.log("Historical replay opened, displayed model evidence, and executed its first held-out tick.");
} finally {
  await browser.close();
}
