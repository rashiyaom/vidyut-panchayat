import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto(process.env.PREVIEW_URL ?? "http://127.0.0.1:4183/");
  await page.waitForFunction(() => !!window.vidyutCity);
  await page.locator("#daylight").click();
  await page.waitForFunction(
    () => window.vidyutCity.getLighting().amount > 0.98,
  );
  expect(
    (await page.evaluate(() => window.vidyutCity.getLighting())).mode,
  ).toBe("night");
  await mkdir("experiments/results", { recursive: true });
  await page.screenshot({
    timeout: 60000,
    path: "experiments/results/cozy-night-overview.png",
  });
  if (errors.length) throw new Error(errors.join("\n"));
  await page.waitForFunction(() =>
    window.vidyutCity.getAudio().recordings.includes("train-horn"),
  );
  // A building inspection must be audible even if the camera is returned to overview.
  const cues: unknown[] = [];
  for (const id of [
    "substation",
    "water",
    "hospital",
    "telecom",
    "fuel",
    "residential",
    "transit",
  ]) {
    await page.evaluate((id) => {
      window.vidyutCity.focus(id);
      window.vidyutCity.resetView();
    }, id);
    await page.waitForFunction(() =>
      window.vidyutCity.getAudio().activeCues.includes("selection"),
    );
    await page.waitForFunction(
      () =>
        window.vidyutCity.getAudio().cueRms > 0.025 &&
        window.vidyutCity.getAudio().outputRms > 0.008,
    );
    cues.push(await page.evaluate(() => window.vidyutCity.getAudio()));
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => window.vidyutCity.focus("transit"));
  await page.waitForFunction(
    () => window.vidyutCity.getAudio().lastCue?.kind === "train-horn",
    null,
    { timeout: 45000 },
  );
  const train = await page.evaluate(() => window.vidyutCity.getAudio());
  await page.screenshot({
    timeout: 60000,
    path: "experiments/results/cozy-night-train.png",
  });
  await page.locator("#directory-toggle").click();
  await page.locator('[data-district="water"]').click();
  await page.waitForTimeout(2000);
  await page.screenshot({
    timeout: 60000,
    path: "experiments/results/cozy-night-beach.png",
  });
  await page.locator("#enter-council").click();
  await page.locator("#leave-council").click();
  expect(
    (await page.evaluate(() => window.vidyutCity.getLighting())).mode,
  ).toBe("night");
  await page.locator("#daylight").click();
  await page.waitForFunction(
    () => window.vidyutCity.getLighting().amount < 0.02,
  );
  expect(
    (await page.evaluate(() => window.vidyutCity.getLighting())).mode,
  ).toBe("golden");
  await page.locator("#daylight").click();
  expect(
    (await page.evaluate(() => window.vidyutCity.getLighting())).mode,
  ).toBe("day");
  await page.evaluate(() => window.vidyutCity.setLightingMode("night"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.vidyutCity.resetView());
  await page.waitForFunction(
    () => window.vidyutCity.getLighting().amount > 0.98,
  );
  await page.screenshot({
    timeout: 60000,
    path: "experiments/results/cozy-night-mobile.png",
  });
  await page.locator("#audio-toggle").click();
  await page.waitForFunction(
    () => window.vidyutCity.getAudio().state === "suspended",
  );
  expect(
    (await page.evaluate(() => window.vidyutCity.getAudio())).activeCues,
  ).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(
    "experiments/results/night-audio-smoke.json",
    JSON.stringify(
      {
        passed: true,
        lighting: await page.evaluate(() => window.vidyutCity.getLighting()),
        cues,
        train,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Night and audio checks passed: rendered lighting, audible building cues, dedicated train horn, mode restoration, mobile and mute cleanup.",
  );
} finally {
  await browser.close();
}
