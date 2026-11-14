import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.PREVIEW_URL ?? "http://127.0.0.1:4174/");
  await page.waitForFunction(() => !!window.vidyutCity);
  expect(
    (await page.evaluate(() => window.vidyutCity.getStats())).disaster.active,
  ).toBe(false);
  await page.locator("#enter-council").click();
  await page.waitForFunction(
    () => window.vidyutCity.getSimulation().state === "AwaitingHuman",
  );
  await page.evaluate(async () => {
    for (let target = 0; target <= 54; target++) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const s = window.vidyutCity.getSimulation();
        if (s.state === "AwaitingHuman" && s.plan)
          await window.vidyutCity.command({
            type: "APPROVE",
            planId: s.plan.id,
            hash: s.plan.hash,
          });
        await window.vidyutCity.command({ type: "STEP" });
        if (window.vidyutCity.getSimulation().tick?.t === target) break;
        if (attempt === 3) throw new Error("Stalled at " + target);
      }
    }
  });
  await page.locator('[data-room-tab="impact"]').click();
  await expect(page.locator("#street-condition")).toHaveText(
    "City under disruption",
  );
  const crisis = await page.evaluate(() => window.vidyutCity.getStats());
  expect(crisis.disaster.active).toBe(true);
  expect(crisis.disaster.busSpeed).toBe(0);
  expect(crisis.disaster.trainSpeed).toBe(0);
  await page.locator("#impact-key summary").click();
  await expect(page.locator("#impact-key")).toContainText("electricity");
  await page.selectOption("#signal-focus", "hospital");
  expect(
    (await page.evaluate(() => window.vidyutCity.getStats())).signals.routes,
  ).toBe(2);
  await page.locator("#signal-visible").uncheck();
  expect(
    (await page.evaluate(() => window.vidyutCity.getStats())).signals.visible,
  ).toBe(false);
  await page.locator("#signal-visible").check();
  await page.waitForTimeout(400);
  await mkdir("experiments/results", { recursive: true });
  await page.screenshot({ path: "experiments/results/disaster-signals.png" });
  await page.locator("#impact-key summary").click();
  await page.locator("#signal-visible").uncheck();
  await page.evaluate(() => window.vidyutCity.focus("transit"));
  await page.waitForTimeout(800);
  await page.screenshot({ path: "experiments/results/disaster-streets.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#signal-visible")).toBeInViewport();
  await page.screenshot({ path: "experiments/results/disaster-mobile.png" });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.locator("#leave-council").click();
  const restored = await page.evaluate(() => window.vidyutCity.getStats());
  expect(restored.disaster).toMatchObject({
    active: false,
    rain: 0,
    carSpeed: 1,
    busSpeed: 1,
    trainSpeed: 1,
  });
  expect(restored.signals.visible).toBe(false);
  const time = restored.ambientTime;
  await page.waitForTimeout(150);
  expect(
    (await page.evaluate(() => window.vidyutCity.getStats())).ambientTime,
  ).toBeGreaterThan(time);
  await page.locator("#enter-council").click();
  await page.locator('[data-room-tab="impact"]').click();
  expect(
    (await page.evaluate(() => window.vidyutCity.getStats())).disaster.active,
  ).toBe(true);
  await page.evaluate(() =>
    window.vidyutCity.updateBuilding("hospital", { scale: 1.5 }),
  );
  const rebuilt = await page.evaluate(() => window.vidyutCity.getStats());
  expect(rebuilt.disaster.active).toBe(true);
  expect(rebuilt.signals.focus).toBe("hospital");
  expect(rebuilt.signals.visible).toBe(false);
  expect(errors).toEqual([]);
  await writeFile(
    "experiments/results/disaster-visual-smoke.json",
    JSON.stringify(
      { passed: true, crisis, restored, rebuilt, errors },
      null,
      2,
    ),
  );
  console.log(
    "Disaster street response, signal controls, mobile layout, rebuild and mode reset passed.",
  );
} finally {
  await browser.close();
}
