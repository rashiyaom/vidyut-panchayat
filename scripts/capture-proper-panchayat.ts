import { chromium, expect } from "@playwright/test";
import path from "node:path";

const ASSETS_DIR = path.resolve("docs/assets");
const PREVIEW_URL = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173/";

console.log("Launching Chromium for Proper Panchayat Courtroom Photos...");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
});

try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1000 },
  });

  await page.goto(PREVIEW_URL + "?seed=42");
  await page.waitForFunction(() => !!window.vidyutCity);
  await page.waitForTimeout(1000);

  // 1. Enter the council
  await page.locator("#enter-council").click();
  await page.waitForFunction(
    () => window.vidyutCity?.getSimulation().state === "AwaitingHuman",
  );
  await expect(page.locator("#conference-canvas")).toBeVisible();
  await expect(page.locator(".delegate-label")).toHaveCount(10);

  // Ensure camera is at authored overview
  await page.locator("#room-overview").click();
  await page.waitForTimeout(1500);

  // Photo 1: Primary 3D Council Chamber (Courtroom View)
  console.log("Capturing panchayat-chamber-3d.png...");
  await page.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-chamber-3d.png"),
  });

  // Photo 2: Delegate Inspection (Select Hospital AI)
  console.log("Capturing panchayat-delegate-inspection.png...");
  await page.locator('[data-delegate="hospital"]').click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-delegate-inspection.png"),
  });

  // Photo 3: Overhead Tactical Table View
  console.log("Capturing panchayat-overhead.png...");
  await page.locator("#room-top").click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-overhead.png"),
  });

  // Switch back to room view
  await page.locator("#room-overview").click();
  await page.waitForTimeout(800);

  // Photo 4: Active Deliberation in Session (Approve & Step to generate real deliberation message & bubble)
  console.log("Capturing panchayat-deliberation-active.png...");
  await page.locator('[data-room-tab="evidence"]').click();
  await page.locator("#guide-approve").click();
  await page.locator("#room-step").click();
  await page.waitForFunction(
    () => window.vidyutCity?.getSimulation().tick?.t === 0,
  );
  await page.locator('[data-room-tab="room"]').click();
  await page.waitForTimeout(1200);

  // Open speaker bubble if present or toggle message
  const speakerToggle = page.locator("#speaker-toggle");
  if (await speakerToggle.isVisible()) {
    await speakerToggle.click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-deliberation-active.png"),
  });

  await page.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-courtroom-close.png"),
  });

  console.log("Successfully captured all proper Panchayat courtroom photos!");
} finally {
  await browser.close();
}
