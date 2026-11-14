import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors: string[] = [],
  external: string[] = [],
  requests: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const baseUrl = process.env.VIDYUT_PREVIEW_URL ?? process.env.PREVIEW_URL ?? "http://127.0.0.1:4174";
await context.route("**/*", (route) => {
  const url = route.request().url();
  requests.push(url);
  if (!url.startsWith(baseUrl)) {
    external.push(url);
    void route.abort();
  } else void route.continue();
});
try {
  await page.goto(`${baseUrl}/?seed=42`);
  await page.locator("#enter-council").click();
  await page.waitForFunction(
    () => window.vidyutCity?.getSimulation().state === "AwaitingHuman",
    null,
    { timeout: 30000 },
  );
  await page.locator('[data-room-tab="evidence"]').click();
  await page.locator("#technical-evidence>summary").click();
  const initialPlanId = await page.evaluate(
    () => window.vidyutCity.getSimulation().plan!.id,
  );
  await page
    .locator("#rejection-note")
    .fill("Reconsider and record this review.");
  await page.locator('[data-action="reject"]').click();
  await page.waitForFunction((id) => {
    const s = window.vidyutCity.getSimulation();
    return s.state === "AwaitingHuman" && s.plan?.id !== id;
  }, initialPlanId);
  await page.locator('[data-action="approve"]').click();
  await page.locator('[data-action="step"]').click();
  await page.waitForFunction(
    () => window.vidyutCity.getSimulation().tick?.t === 0,
  );
  // Engine operations still go through the public worker bridge. Approve each newly negotiated plan.
  for (let t = 1; t <= 55; t++) {
    await page.evaluate(async (target) => {
      for (let retries = 0; retries < 4; retries++) {
        const s = window.vidyutCity.getSimulation();
        if (s.state === "AwaitingHuman" && s.plan)
          await window.vidyutCity.command({
            type: "APPROVE",
            planId: s.plan.id,
            hash: s.plan.hash,
          });
        await window.vidyutCity.command({ type: "STEP" });
        if (window.vidyutCity.getSimulation().tick?.t === target) return;
      }
      throw new Error("Did not advance to " + target);
    }, t);
  }
  const crisis = await page.evaluate(() => window.vidyutCity.getSimulation());
  if (!crisis.verification)
    throw new Error("Approved plan never reached verification");
  if (
    crisis.tick?.supply !== 55 ||
    crisis.tick.lines.find((l) => l.id === "bus-central")?.capacity !== 30
  )
    throw new Error("Crisis not applied");
  await page.selectOption("#sim-baseline", "equal");
  await page.waitForFunction(() =>
    document.querySelector("#sim-comparison")?.textContent?.includes("tick 55"),
  );
  await page.locator('[data-room-tab="impact"]').click();
  const frames = await page.evaluate<number>(
    `new Promise(resolve=>{const start=performance.now();let frames=0;function frame(now){frames++;if(now-start>2000)resolve(frames*1000/(now-start));else requestAnimationFrame(frame);}requestAnimationFrame(frame);})`,
  );
  await page.locator('[data-room-tab="evidence"]').click();
  await page.selectOption("#sim-baseline", "off");
  let crashDetected = false,
    rejoined = false;
  for (let t = 56; t < 144; t++) {
    await page.evaluate(async (target) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const s = window.vidyutCity.getSimulation();
        if (s.state === "AwaitingHuman" && s.plan)
          await window.vidyutCity.command({
            type: "APPROVE",
            planId: s.plan.id,
            hash: s.plan.hash,
          });
        await window.vidyutCity.command({ type: "STEP" });
        if (window.vidyutCity.getSimulation().tick?.t === target) return;
      }
      throw new Error("Full day stalled at " + target);
    }, t);
    if (t === 109)
      crashDetected = await page.evaluate(
        () =>
          !!window.vidyutCity
            .getSimulation()
            .tick?.agents.find((a) => a.id === "telecom")?.isDown,
      );
    if (t === 111)
      rejoined = await page.evaluate(
        () =>
          !window.vidyutCity
            .getSimulation()
            .tick?.agents.find((a) => a.id === "telecom")?.isDown,
      );
  }
  const completed = await page.evaluate(
    () => window.vidyutCity.getSimulation().tick!.t === 143,
  );
  if (!completed || !crashDetected || !rejoined)
    throw new Error("Full day/crash/rejoin failed");
  await page.evaluate(async () => {
    await window.vidyutCity.command({ type: "SEEK", tick: 12 });
    await window.vidyutCity.command({
      type: "TRIGGER_EVENT",
      event: { type: "drop", tick: 13, label: "Smoke test dropped bids" },
    });
    await window.vidyutCity.command({ type: "REQUEST_PLAN", horizonTicks: 3 });
    const s = window.vidyutCity.getSimulation();
    if (!s.plan) throw new Error("Missing plan");
    await window.vidyutCity.command({
      type: "APPROVE",
      planId: s.plan.id,
      hash: s.plan.hash,
    });
    await window.vidyutCity.command({ type: "STEP" });
  });
  const dropped = await page.evaluate(() => window.vidyutCity.getSimulation());
  if (
    !dropped.tick?.negotiation.fallback ||
    dropped.tick.negotiation.aborts !== 2 ||
    dropped.branch < 1
  )
    throw new Error("Drop/fork failed");
  await page.evaluate(() => {
    window.vidyutCity.updateBuilding("hospital", { offset: [2, -1] });
    window.vidyutCity.focus("hospital");
  });
  if (!(await page.locator("#selection").isVisible()))
    throw new Error("Selection lost after rebuild");
  await context.setOffline(true);
  await page.evaluate(async () => {
    await window.vidyutCity.command({ type: "STEP" });
  });
  await page
    .locator("summary")
    .filter({ hasText: "Ten utilities & participation" })
    .click();
  await page.locator('[data-agent="residential"]').uncheck();
  await page.waitForFunction(
    () => window.vidyutCity.getSimulation().branch === 2,
  );
  await page.evaluate(async () => {
    await window.vidyutCity.command({ type: "REQUEST_PLAN", horizonTicks: 3 });
    const s = window.vidyutCity.getSimulation();
    await window.vidyutCity.command({
      type: "APPROVE",
      planId: s.plan!.id,
      hash: s.plan!.hash,
    });
    await window.vidyutCity.command({ type: "STEP" });
  });
  const unmanaged = await page.evaluate(() =>
    window.vidyutCity
      .getSimulation()
      .tick!.agents.find((a) => a.id === "residential")!,
  );
  if (
    unmanaged.enabled ||
    Math.abs(unmanaged.allocated - unmanaged.demand) > 0.01
  )
    throw new Error("Unmanaged load toggle failed");
  await page.screenshot({ path: "experiments/results/browser-smoke.png" });
  if (errors.length || external.length)
    throw new Error(JSON.stringify({ errors, external }));
  await mkdir("experiments/results", { recursive: true });
  const report = {
    passed: true,
    completed144Ticks: completed,
    crashDetected,
    rejoined,
    unmanagedDraw: unmanaged.allocated,
    productionURL: baseUrl,
    externalRequests: external,
    consoleErrors: errors,
    requests,
    comparisonFps: frames,
    stats: await page.evaluate(() => window.vidyutCity.getStats()),
    crisis: {
      tick: crisis.tick.t,
      supply: crisis.tick.supply,
      triage: crisis.tick.negotiation.triage,
      violations: crisis.tick.metrics.violations,
    },
    fallback: {
      tick: dropped.tick.t,
      aborts: dropped.tick.negotiation.aborts,
      branch: dropped.branch,
    },
    verification: crisis.verification?.result ?? null,
  };
  await writeFile(
    "experiments/results/browser-smoke.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
