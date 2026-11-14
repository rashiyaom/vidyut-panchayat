import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(process.env.PREVIEW_URL ?? "http://127.0.0.1:4173/");
  await expect(page.locator("#tutorial-title")).toHaveText("Welcome to Nagar");
  await expect(page.locator("body")).toHaveAttribute("data-lighting", "day");
  await expect(page.locator("#labels")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#panchayat-pin")).toBeVisible();
  await page.locator("#tutorial-next").click();
  await expect(page.locator("#tutorial-title")).toContainText(
    "Panchayat Square",
  );
  await page.locator("#tutorial-skip").click();
  await expect(page.locator("#tutorial-confirm")).toBeVisible();
  await page.locator("#tutorial-stay").click();
  await expect(page.locator("#tutorial-confirm")).toBeHidden();
  await page.locator("#tutorial-skip").click();
  await page.locator("#tutorial-skip-confirm").click();
  await expect(page.locator("#tutorial-layer")).toBeHidden();
  await page.locator("#tutorial-launcher").click();
  await expect(page.locator("#tutorial-title")).toHaveText("Welcome to Nagar");
  await page.locator("#tutorial-exit").click();
  await expect(page.locator("#tutorial-confirm")).toBeVisible();
  await page.locator("#tutorial-skip-confirm").click();

  await page.screenshot({ path: "/tmp/vidyut-city-controls.png" });
  console.log("City tutorial passed; starting facilities.");
  await page.locator("#facility-tour").click();
  await expect(page.locator("#tutorial-mode")).toHaveText("FACILITY TOUR");
  const titles: string[] = [];
  for (let i = 0; i < 12; i++) {
    await expect(page.locator("#tutorial-count")).toHaveText(`${i + 1} / 12`);
    await expect(page.locator("#tutorial-next")).toBeEnabled();
    await expect(page.locator("#tutorial-title")).not.toBeEmpty();
    titles.push(await page.locator("#tutorial-title").innerText());
    await page.locator("#tutorial-next").click();
  }
  if (new Set(titles).size !== 12 || !titles.at(-1)?.includes("Panchayat"))
    throw new Error(`Facility tour missed a stop: ${titles.join(" | ")}`);
  await expect(page.locator("#tutorial-layer")).toBeHidden();

  console.log("Facility tour passed; entering council.");
  await page.locator("#enter-council").click();
  await page.screenshot({ path: "/tmp/vidyut-council-compact.png" });
  await expect(page.locator("#tutorial-mode")).toHaveText(
    "DISASTER COUNCIL GUIDE",
  );
  await expect(page.locator("#tutorial-title")).toContainText(
    "Choose an emergency",
  );
  await page.locator("#tutorial-skip").click();
  await page.locator("#tutorial-skip-confirm").click();
  await page.locator("#tutorial-launcher").click();
  await expect(page.locator("#tutorial-title")).toContainText(
    "Choose an emergency",
  );
  await page.locator("#tutorial-skip").click();
  await page.locator("#tutorial-skip-confirm").click();
  await page.locator("#leave-council").click();
  console.log("Council tutorial passed; opening Real System.");
  await page.locator("#reality-entry").click();
  await expect(page.locator("#tutorial-mode")).toHaveText("REAL SYSTEM GUIDE");
  await page.locator("#tutorial-skip").click();
  await page.locator("#tutorial-skip-confirm").click();
  await page.reload();
  await expect(page.locator("#tutorial-layer")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#tutorial-launcher").click();
  await expect(page.locator("#tutorial-title")).toBeVisible();
  const card = await page.locator(".tutorial-card").boundingBox();
  if (
    !card ||
    card.x < 0 ||
    card.x + card.width > 390 ||
    card.y < 0 ||
    card.y + card.height > 844
  )
    throw new Error("Mobile tutorial card escaped the viewport");
  await page.screenshot({ path: "/tmp/vidyut-tutorial-mobile.png" });
  await page.locator("#tutorial-skip").click();
  await page.locator("#tutorial-skip-confirm").click();
  if (errors.length) throw new Error(errors.join("; "));
  console.log(
    "First visit, skip confirmation, restart, 11 facilities, council, and Real System guides passed.",
  );
} finally {
  await browser.close();
}
