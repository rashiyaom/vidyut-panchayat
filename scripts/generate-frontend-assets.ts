import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";

const ASSETS_DIR = path.resolve("docs/assets");
const RECORDINGS_DIR = path.resolve("scratch/recordings");
const PREVIEW_URL = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173/";

await mkdir(ASSETS_DIR, { recursive: true });
await mkdir(RECORDINGS_DIR, { recursive: true });

// Clean old recordings
for (const file of await readdir(RECORDINGS_DIR)) {
  if (file.endsWith(".webm")) {
    await unlink(path.join(RECORDINGS_DIR, file));
  }
}

console.log("Launching Chromium for visual asset capture...");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
});

try {
  // --- 1. RECORDING: PANCHAYAT COUNCIL EXPERIENCE ---
  console.log("Recording Panchayat Chamber & Decision Workflow...");
  const context1 = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 1280, height: 800 },
    },
  });

  const page1 = await context1.newPage();
  await page1.goto(PREVIEW_URL + "?seed=42");
  await page1.waitForFunction(() => !!window.vidyutCity);
  await page1.waitForTimeout(1000);

  // Capture normal city overview screenshot
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "city-overview.png"),
  });

  // Enter the council
  await page1.locator("#enter-council").click();
  await page1.waitForFunction(
    () => window.vidyutCity?.getSimulation().state === "AwaitingHuman",
  );
  await page1.waitForTimeout(1200);

  // Capture 3D Council Room screenshot
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-chamber-3d.png"),
  });

  // Switch to overhead view
  await page1.locator("#room-top").click();
  await page1.waitForTimeout(800);
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-overhead.png"),
  });

  // Switch back to room view and select Hospital delegate
  await page1.locator("#room-overview").click();
  await page1.waitForTimeout(500);
  await page1.locator('[data-delegate="hospital"]').click();
  await page1.waitForTimeout(800);
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "panchayat-delegate-inspection.png"),
  });

  // Open Decision Guide tab
  await page1.locator('[data-room-tab="evidence"]').click();
  await page1.waitForTimeout(600);
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "operator-decision-guide.png"),
  });

  // Expand advanced technical evidence
  await page1.locator("#technical-evidence > summary").click();
  await page1.waitForTimeout(600);
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "advanced-technical-evidence.png"),
  });

  // Approve plan and step
  await page1.locator("#guide-approve").click();
  await page1.waitForTimeout(400);
  await page1.locator("#room-step").click();
  await page1.waitForFunction(
    () => window.vidyutCity?.getSimulation().tick?.t === 0,
  );
  await page1.waitForTimeout(800);

  // Switch to Group Conversation
  await page1.locator('[data-room-tab="chat"]').click();
  await page1.locator("#show-all-messages").click();
  await page1.waitForTimeout(600);
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "negotiation-deliberation-chat.png"),
  });

  // Switch to City Impact view
  await page1.locator('[data-room-tab="impact"]').click();
  await page1.waitForTimeout(800);
  await page1.screenshot({
    path: path.join(ASSETS_DIR, "disaster-city-impact.png"),
  });

  // Step a couple of ticks to show dynamic changes
  for (let t = 1; t <= 3; t++) {
    await page1.evaluate(async () => {
      const sim = window.vidyutCity?.getSimulation();
      if (sim?.state === "AwaitingHuman" && sim?.plan) {
        await window.vidyutCity.command({
          type: "APPROVE",
          planId: sim.plan.id,
          hash: sim.plan.hash,
        });
      }
      await window.vidyutCity.command({ type: "STEP" });
    });
    await page1.waitForTimeout(500);
  }

  // Back to Council Room view
  await page1.locator('[data-room-tab="room"]').click();
  await page1.waitForTimeout(1000);

  const video1 = await page1.video()?.path();
  await context1.close();

  // --- 2. RECORDING: 3D LIVING CITY & DISASTER NAVIGATION ---
  console.log("Recording Living 3D City & Navigation...");
  const context2 = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 1280, height: 800 },
    },
  });

  const page2 = await context2.newPage();
  await page2.goto(PREVIEW_URL + "?seed=42");
  await page2.waitForFunction(() => !!window.vidyutCity);
  await page2.waitForTimeout(1000);

  // Orbit camera around the city
  await page2.mouse.move(640, 400);
  await page2.mouse.down({ button: "left" });
  for (let dx = 0; dx < 200; dx += 20) {
    await page2.mouse.move(640 + dx, 400 - dx * 0.2);
    await page2.waitForTimeout(50);
  }
  await page2.mouse.up({ button: "left" });
  await page2.waitForTimeout(800);

  // Select a landmark / building
  await page2.evaluate(() => window.vidyutCity.focus("hospital"));
  await page2.waitForTimeout(1200);

  await page2.evaluate(() => window.vidyutCity.focus("substation-central"));
  await page2.waitForTimeout(1200);

  // Enter council and look at city impact with signal tracing
  await page2.locator("#enter-council").click();
  await page2.waitForFunction(
    () => window.vidyutCity?.getSimulation().state === "AwaitingHuman",
  );
  await page2.evaluate(async () => {
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
  await page2.waitForFunction(
    () => window.vidyutCity?.getSimulation().tick?.t === 0,
  );
  await page2.locator('[data-room-tab="impact"]').click();
  await page2.waitForTimeout(800);

  // Focus signals on hospital
  await page2.selectOption("#signal-focus", "hospital");
  await page2.waitForTimeout(1000);

  // Focus signals on water works
  await page2.selectOption("#signal-focus", "water");
  await page2.waitForTimeout(1000);

  const video2 = await page2.video()?.path();
  await context2.close();

  console.log("Video recordings saved. Converting to animated GIFs with ffmpeg...");

  if (video1) {
    const gif1 = path.join(ASSETS_DIR, "panchayat-council-deliberation.gif");
    console.log(`Generating ${gif1} from ${video1}...`);
    execSync(
      `/opt/homebrew/bin/ffmpeg -y -i "${video1}" -vf "fps=10,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${gif1}"`,
      { stdio: "inherit" },
    );
  }

  if (video2) {
    const gif2 = path.join(ASSETS_DIR, "city-exploration-and-disaster.gif");
    console.log(`Generating ${gif2} from ${video2}...`);
    execSync(
      `/opt/homebrew/bin/ffmpeg -y -i "${video2}" -vf "fps=10,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${gif2}"`,
      { stdio: "inherit" },
    );
  }

  console.log("All screenshots and GIFs successfully generated in docs/assets/!");
} finally {
  await browser.close();
}
