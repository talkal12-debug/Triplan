import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * Builds a Rome trip through the wizard, generates the plan and exercises the
 * plan views: timeline actions, map (real tiles), calendar and list.
 */
async function buildRomeTrip(page: Page) {
  await page.goto("/he/plan/destination");
  const next = page.getByRole("button", { name: "המשך" });
  await page.getByRole("checkbox", { name: "בחר את איטליה" }).click();
  await next.click();
  for (const step of ["dates", "party", "visit", "pace", "transport", "interests", "budget", "hotel"]) {
    await expect(page).toHaveURL(new RegExp(`/plan/${step}$`));
    await next.click();
  }
  await expect(page).toHaveURL(/\/plan\/summary$/);
  await page.getByRole("button", { name: "בנה לי טיול" }).click();
  await expect(page).toHaveURL(/\/he\/trip\/g_/);
  await page.getByRole("button", { name: "בנה תוכנית" }).click();
  await expect(page.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 30_000 });
}

test("plan views: timeline actions, map tiles, calendar, list", async ({ page }, testInfo) => {
  await buildRomeTrip(page);

  // Timeline: day chips and stops with menus.
  const dayTabs = page.getByRole("tablist", { name: "ימי הטיול" }).getByRole("tab");
  await expect(dayTabs.first()).toHaveAttribute("aria-selected", "true");
  const stopsBefore = await page.getByRole("button", { name: /^פעולות עבור/ }).count();
  expect(stopsBefore).toBeGreaterThan(0);

  // Lock the first stop through its menu, then remove the second one.
  await page.getByRole("button", { name: /^פעולות עבור/ }).first().click();
  await page.getByRole("menuitem", { name: "נעל במקום" }).click();
  await expect(page.getByText("נעול").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^פעולות עבור/ }).nth(1).click();
  await page.getByRole("menuitem", { name: "הסר מהתוכנית" }).click();
  await expect(page.getByRole("button", { name: /^פעולות עבור/ })).toHaveCount(stopsBefore - 1, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "בטל שינוי אחרון" })).toBeVisible();

  // Swap: the sheet lists alternatives.
  await page.getByRole("button", { name: /^פעולות עבור/ }).first().click();
  await page.getByRole("menuitem", { name: "החלף פעילות" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "בחר" }).first()).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");

  // Second day, "too busy" makes it lighter.
  await dayTabs.nth(1).click();
  const day2Stops = await page.getByRole("button", { name: /^פעולות עבור/ }).count();
  await page.getByRole("button", { name: "היום עמוס מדי" }).click();
  await expect(page.getByRole("button", { name: /^פעולות עבור/ })).toHaveCount(day2Stops - 1, { timeout: 15_000 });

  // Map: real vector tiles render (canvas is not a flat colour).
  await page.getByRole("tab", { name: "מפה" }).click();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => (window as unknown as { __triplanMap?: { loaded(): boolean } }).__triplanMap?.loaded() === true, null, { timeout: 30_000 });
  await expect(page.locator(".maplibregl-marker")).toHaveCount(day2Stops - 1 + 1); // stops + hotel
  // Screenshot the composited canvas and count colours: a flat background means no tiles.
  await page.waitForTimeout(1500);
  const png = await page.locator("canvas.maplibregl-canvas").screenshot({ path: testInfo.outputPath("map.png") });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const colours = new Set<number>();
  for (let i = 0; i < data.length; i += info.channels * 7) {
    colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  }
  expect(colours.size).toBeGreaterThan(50);

  // Calendar: trip days are buttons, clicking returns to the timeline on that day.
  await page.getByRole("tab", { name: "לוח שנה" }).click();
  await page.getByRole("button", { name: /^16/ }).first().click();
  await expect(page.getByRole("tab", { name: "ציר זמן" })).toHaveAttribute("data-state", "active");
  await expect(dayTabs.first()).toHaveAttribute("aria-selected", "true");

  // List: all days visible with drag handles.
  await page.getByRole("tab", { name: "רשימה" }).click();
  await expect(page.getByRole("heading", { name: /^יום 5/ })).toBeVisible();
  expect(await page.getByRole("button", { name: /^גרור את/ }).count()).toBeGreaterThan(5);

  // "My day" page renders and offers a day picker (the trip is in the future).
  await page.goto(page.url().replace(/\/?$/, "") + "/now");
  await expect(page.getByRole("heading", { name: "היום שלי" })).toBeVisible();
  await expect(page.getByText(/הטיול לא מתקיים היום/)).toBeVisible();
  await page.getByRole("button", { name: /^יום 1/ }).click();
  // Depending on the time of day this is "now / next" with a navigate button, or "done for today".
  await expect(page.getByRole("link", { name: "נווט לשם" }).first().or(page.getByText(/סיימתם להיום/))).toBeVisible();
});
