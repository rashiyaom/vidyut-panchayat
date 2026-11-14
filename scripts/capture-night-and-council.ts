import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";

const ASSETS_DIR = path.resolve("docs/assets");
const RECORDINGS_DIR = path.resolve("scratch/recordings");
const PREVIEW_URL = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173/";

await mkdir(ASSETS_DIR, { recursive: true });
await mkdir(RECORDINGS_DIR, { recursive: true });

for (const file of await readdir(RECORDINGS_DIR)) {
  if (file.endsWith(".webm")) {
    await unlink(path.join(RECORDINGS_DIR, file));
  }
}

console.log("Launching Chromium for Night Mode & Council Room Retake...");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
});

try {
  // ==========================================
  // 1. NIGHT MODE & LIGHTING CYCLE
  // ==========================================
  console.log("Capturing Night Mode and Lighting Transitions...");
  const context1 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  const page1 = await context1.newPage();
  await page1.goto(PREVIEW_URL + "?seed=42");
  await page1.waitForFunction(() => !!window.vidyutCity);
  await page1.waitForTimeout(1500);

  // Smooth camera orbit in daylight
  await page1.mouse.move(720, 450);
  await page1.mouse.down({ button: "left" });
  for (let dx = 0; dx < 120; dx += 15) {
    await page1.mouse.move(720 + dx, 450 - dx * 0.15);
    await page1.waitForTimeout(40);
  }
  await page1.mouse.up({ button: "left" });
  await page1.waitForTimeout(1000);

  // Switch to Cozy Night
  await page1.locator("#daylight").click();
  await page1.waitForFunction(
    () => document.body.dataset.lighting === "night",
  );
  await page1.waitForTimeout(2000);

  // Capture High-Res City Night Mode
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "city-night-mode.png"),
  });

  // Orbit camera in night mode to showcase glow, traffic headlights, and coastline
  await page1.mouse.move(720, 450);
  await page1.mouse.down({ button: "left" });
  for (let dx = 0; dx < 140; dx += 15) {
    await page1.mouse.move(720 + dx, 450 - dx * 0.1);
    await page1.waitForTimeout(40);
  }
  await page1.mouse.up({ button: "left" });
  await page1.waitForTimeout(1500);

  // Switch to Golden Hour
  await page1.locator("#daylight").click();
  await page1.waitForFunction(
    () => document.body.dataset.lighting === "golden",
  );
  await page1.waitForTimeout(2000);

  // Capture High-Res Golden Hour
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "city-golden-hour.png"),
  });

  // Switch back to Day
  await page1.locator("#daylight").click();
  await page1.waitForFunction(
    () => document.body.dataset.lighting === "day",
  );
  await page1.waitForTimeout(1000);

  const video1 = await page1.video()?.path();
  await context1.close();

  // ==========================================
  // 2. DISASTER NIGHT RESPONSE
  // ==========================================
  console.log("Capturing Disaster Response at Night...");
  const pageDisaster = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await pageDisaster.goto(PREVIEW_URL + "?seed=42");
  await pageDisaster.waitForFunction(() => !!window.vidyutCity);

  // Set night mode
  await pageDisaster.locator("#daylight").click();
  await pageDisaster.waitForFunction(
    () => document.body.dataset.lighting === "night",
  );

  // Enter council and look at city impact
  await pageDisaster.locator("#enter-council").click();
  await pageDisaster.waitForFunction(
    () => window.vidyutCity?.getSimulation().state === "AwaitingHuman",
  );
  await pageDisaster.evaluate(async () => {
    const s = window.vidyutCity.getSimulation();
    if (s.state === "AwaitingHuman" && s.plan) {
      await window.vidyutCity.command({
        type: "APPROVE",
        planId: s.plan.id,
        hash: s.plan.hash,
      });
    }
    await window.vidyutCity.command({ type: "STEP" });
  });
  await pageDisaster.waitForFunction(
    () => window.vidyutCity?.getSimulation().tick?.t === 0,
  );
  await pageDisaster.locator('[data-room-tab="impact"]').click();
  await pageDisaster.waitForTimeout(1500);

  await pageDisaster.screenshot({
    path: path.join(ASSETS_DIR, "disaster-night-impact.png"),
  });
  await pageDisaster.close();

  // ==========================================
  // 3. COURT ROOM PANCHAYAT PHOTO RETAKE
  // ==========================================
  console.log("Retaking Court Room Panchayat Chamber Photo...");
  const pageCouncil = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  await pageCouncil.goto(PREVIEW_URL + "?seed=42");
  await pageCouncil.waitForFunction(() => !!window.vidyutCity);

  await pageCouncil.locator("#enter-council").click();
  await pageCouncil.waitForFunction(
    () => window.vidyutCity?.getSimulation().state === "AwaitingHuman",
  );
  await pageCouncil.waitForTimeout(1500);

  // Smoothly orbit camera slightly for a stunning three-quarter isometric perspective
  const canvas = pageCouncil.locator("#conference-canvas");
  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await pageCouncil.mouse.move(cx, cy);
    await pageCouncil.mouse.down({ button: "left" });
    await pageCouncil.mouse.move(cx - 180, cy - 40, { steps: 25 });
    await pageCouncil.mouse.up({ button: "left" });
    await pageCouncil.waitForTimeout(1200);
  }

  // Select Hospital AI to highlight delegate with halo ring and microphone
  await pageCouncil.locator('[data-delegate="hospital"]').click();
  await pageCouncil.waitForTimeout(1000);

  // Retake Primary 3D Panchayat Chamber Photo
  await pageCouncil.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-chamber-3d.png"),
  });

  // Retake Dedicated Courtroom Panchayat View
  await pageCouncil.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-courtroom-close.png"),
  });

  // Step the simulation once to show active negotiation speech bubble
  await pageCouncil.locator('[data-room-tab="evidence"]').click();
  await pageCouncil.locator("#guide-approve").click();
  await pageCouncil.locator("#room-step").click();
  await pageCouncil.waitForFunction(
    () => window.vidyutCity?.getSimulation().tick?.t === 0,
  );
  await pageCouncil.locator('[data-room-tab="room"]').click();
  await pageCouncil.waitForTimeout(1000);

  await pageCouncil.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-deliberation-active.png"),
  });

  await pageCouncil.close();

  // ==========================================
  // 4. CONVERT NIGHT CYCLE VIDEO TO GIF
  // ==========================================
  if (video1) {
    const gif = path.join(ASSETS_DIR, "lighting-cycle-day-to-night.gif");
    console.log(`Generating ${gif} from ${video1}...`);
    execSync(
      `/opt/homebrew/bin/ffmpeg -y -i "${video1}" -vf "fps=10,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${gif}"`,
      { stdio: "inherit" },
    );
  }

  console.log("All Night Mode and Panchayat Retake photos successfully created!");
} finally {
  await browser.close();
}
