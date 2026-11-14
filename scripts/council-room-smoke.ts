import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
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
    }),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.PREVIEW_URL ?? "http://127.0.0.1:4173/");
  await page.waitForFunction(() => !!window.vidyutCity);
  const before = await page.evaluate(
    () => window.vidyutCity.getStats().ambientTime,
  );
  await page.waitForTimeout(500);
  const initial = await page.evaluate(() => ({
    stats: window.vidyutCity.getStats(),
    sim: window.vidyutCity.getSimulation(),
  }));
  if (
    initial.stats.ambientPaused ||
    initial.stats.ambientTime <= before ||
    initial.sim.plan ||
    initial.sim.tick
  )
    throw new Error("Normal city must animate without disaster initialization");
  await page.locator("#pause").click();
  if (!(await page.evaluate(() => window.vidyutCity.getStats().ambientPaused)))
    throw new Error("Normal pause control failed");
  await page.locator("#pause").click();
  await page.locator("#enter-council").click();
  await page.waitForFunction(
    () => window.vidyutCity?.getSimulation().state === "AwaitingHuman",
  );
  await expect(page.locator("#conference-canvas")).toBeVisible();
  await expect(page.locator(".delegate-label")).toHaveCount(10);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "experiments/results/council-room.png" });
  await page.locator('[data-delegate="telecom"]').click();
  await expect(page.locator("#delegate-detail h2")).toHaveText("Telecom AI");
  await page.locator("#room-top").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "experiments/results/council-overhead.png" });
  await page.locator('[data-room-tab="evidence"]').click();
  await expect(page.locator("#decision-guide")).toContainText(
    "Before the city moves",
  );
  await page.screenshot({ path: "experiments/results/council-decision.png" });
  await page.locator("#guide-approve").click();
  await page.locator("#room-step").click();
  await page.waitForFunction(
    () => window.vidyutCity.getSimulation().tick?.t === 0,
  );
  await page.locator('[data-room-tab="chat"]').click();
  await page.locator("#show-all-messages").click();
  await expect(page.locator("#chat-messages")).toContainText(
    "Revised water-routing proposal",
  );
  await expect(page.locator("#chat-messages")).toContainText("Palm Beach");
  await expect(page.locator(".chat-message")).toHaveCount(19);
  await page.selectOption("#topic-filter", "Water");
  await expect(page.locator(".chat-message")).toHaveCount(6);
  await page.locator('[data-reply="water-opening"]').first().click();
  await expect(page.locator("#topic-filter")).toHaveValue("all");
  await page.screenshot({ path: "experiments/results/civic-discussion.png" });
  await page.locator('[data-discussion-mode="protocol"]').click();
  await expect(page.locator("#chat-messages")).toContainText(
    "Agreement confirmed",
  );
  await page.selectOption("#chat-filter", "hospital");
  await expect(page.locator(".chat-message").first()).toContainText(
    "Hospital AI",
  );
  await page.screenshot({ path: "experiments/results/council-chat.png" });
  await page.locator('[data-room-tab="results"]').click();
  await expect(page.locator(".allocation-bars>div")).toHaveCount(10);
  await page.locator('[data-room-tab="impact"]').click();
  await expect(page.locator("#city-impact-view #city-canvas")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "experiments/results/council-city-impact.png",
  });
  await page.evaluate(() =>
    window.vidyutCity.command({ type: "RUN", speed: 8 }),
  );
  await page.locator("#leave-council").click();
  await page.waitForFunction(
    () =>
      !window.vidyutCity.getSimulation().state ||
      !document.body.classList.contains("in-council"),
  );
  await page.waitForTimeout(200);
  const pausedTick = await page.evaluate(
    () => window.vidyutCity.getSimulation().tick?.t,
  );
  await page.waitForTimeout(250);
  if (
    (await page.evaluate(() => window.vidyutCity.getSimulation().tick?.t)) !==
    pausedTick
  )
    throw new Error("Disaster clock continued after leaving");
  await expect(page.locator("#council-experience")).toBeHidden();
  const restored = await page.evaluate(
    () => window.vidyutCity.getStats().ambientTime,
  );
  await page.waitForTimeout(300);
  if (
    (await page.evaluate(() => window.vidyutCity.getStats().ambientTime)) <=
    restored
  )
    throw new Error("City did not resume");
  await page.evaluate(() => window.vidyutCity.focus("block-3-3"));
  await expect(page.locator("#council-experience")).toBeHidden();
  await page.locator("#building-enter-council").click();
  await expect(page.locator("#council-experience")).toBeVisible();
  await page.locator('[data-room-tab="room"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "experiments/results/council-mobile.png" });
  await page.locator('[data-room-tab="chat"]').click();
  await page.locator('[data-discussion-mode="civic"]').click();
  await page.selectOption("#topic-filter", "Public safety");
  await expect(page.locator(".chat-message")).toHaveCount(5);
  await page.screenshot({ path: "experiments/results/civic-mobile.png" });
  await page.locator("#audio-settings").click();
  const bounds = await page.locator("#audio-panel").boundingBox();
  if (!bounds || bounds.width > 215 || bounds.height > 190)
    throw new Error("Sound popover is not compact");
  await expect(page.locator("#audio-fine-tune")).not.toHaveAttribute("open");
  await page.screenshot({ path: "experiments/results/civic-audio-mobile.png" });
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    "experiments/results/council-room-smoke.json",
    JSON.stringify(
      {
        passed: true,
        errors,
        seats: 10,
        checks: [
          "normal city starts animated without disaster",
          "normal pause and resume",
          "guided approval",
          "disaster city impact view",
          "normal mode restored on exit",
          "3D room",
          "overhead",
          "agent selection",
          "approval and real tick",
          "group messages",
          "filter",
          "collective result",
          "city return",
          "Panchayat entry",
          "mobile layout",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Council room browser checks passed");
} finally {
  await browser.close();
}
