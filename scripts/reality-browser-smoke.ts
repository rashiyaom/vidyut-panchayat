import { chromium } from "@playwright/test";
import grid from "../data/processed/telemetry/pt_load_2014-09-15.json";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  for (const mode of ["city", "council", "reality", "facilities"])
    localStorage.setItem(`vp:tutorial:${mode}:v1`, "done");
});
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.VIDYUT_PREVIEW_URL ?? process.env.PREVIEW_URL ?? "http://127.0.0.1:4174";
try {
  await page.goto(`${base}/?reality=1`);
  await page.locator("#reality-page").waitFor({ state: "visible" });
  if (!(await page.getByText("See what is measured.", { exact: false }).isVisible())) throw new Error("Reality page hero missing");
  if (await page.locator("#rv-agent-list button").count() !== 10) throw new Error("Ten agent profiles missing");
  await page.waitForTimeout(1700);
  await page.screenshot({ path: "/tmp/vidyut-reality-hero.png" });
  await page.getByRole("tab", { name: "04 Telemetry" }).click();
  await page.locator("#rv-timeline").fill("6");
  await page.locator("#rv-lab").screenshot({ path: "/tmp/vidyut-reality-lab.png" });
  if (!(await page.locator("#rv-stage-numbers").textContent())?.includes(grid.samples[1].loadMw.toLocaleString("en-US")))
    throw new Error("Timed grid-load reveal is wrong");
  await page.locator("#rv-agent-list [data-agent=hospital]").click();
  if (!(await page.locator("#rv-agent-detail").textContent())?.includes("Hospital")) throw new Error("Agent detail missing");
  await page.locator("#rv-back").click();
  if (await page.locator("#reality-page").isVisible()) throw new Error("Return to city failed");
  await page.locator("#reality-entry").click();
  if (!(await page.locator("#reality-page").isVisible())) throw new Error("City entry button failed");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#reality-page").evaluate((element) => { element.style.scrollBehavior = "auto"; element.scrollTop = 0; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: "/tmp/vidyut-reality-mobile.png" });
  if (!(await page.locator("#rv-back").isVisible())) throw new Error("Mobile return link missing");
  if (errors.length) throw new Error(errors.join("; "));
  console.log("Reality page route, ten agents, time scrubber, and city navigation passed.");
} finally {
  await browser.close();
}
