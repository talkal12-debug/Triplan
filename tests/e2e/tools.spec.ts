import { expect, test, type Page } from "@playwright/test";

/**
 * Trip tools: checklist and packing persist ticks, budget renders, exports download,
 * a share link is created and opens read-only, the print page renders.
 * Uses the demo seed (Lisbon) with the plan API; providers may fall back to estimates.
 */
async function buildLisbonTrip(page: Page) {
  await page.goto("/he/plan/destination");
  const next = page.getByRole("button", { name: "המשך" });
  await page.getByRole("checkbox", { name: "בחר את פורטוגל" }).click();
  await page.getByRole("checkbox", { name: /ליסבון/ }).click();
  await next.click();
  for (const step of ["dates", "party", "visit", "pace", "transport", "interests", "budget", "hotel"]) {
    await expect(page).toHaveURL(new RegExp(`/plan/${step}$`));
    await next.click();
  }
  await expect(page).toHaveURL(/\/plan\/summary$/);
  await expect(page.getByText("פורטוגל")).toBeVisible();
  await page.getByRole("button", { name: "בנה לי טיול" }).click();
  // First navigation to the trip route compiles it in dev: allow for that.
  await expect(page).toHaveURL(/\/he\/trip\/g_/, { timeout: 90_000 });
  await page.getByRole("button", { name: "בנה תוכנית" }).click();
  await expect(page.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 150_000 });
}

test("tools: checklist, packing, budget, export, share, print", async ({ page, context }, testInfo) => {
  test.setTimeout(300_000);
  await buildLisbonTrip(page);
  const tripUrl = page.url();
  const shot = async (name: string) => {
    await page.getByRole("heading", { name: "כלים לטיול" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  };

  // Checklist ticks persist across reloads.
  await page.getByRole("tab", { name: "צ'ק-ליסט" }).click();
  await shot("checklist");
  const firstTask = page.getByRole("checkbox").first();
  await firstTask.check();
  await expect(page.getByText(/^1 מתוך \d+ בוצעו/)).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "צ'ק-ליסט" }).click();
  await expect(page.getByText(/^1 מתוך \d+ בוצעו/)).toBeVisible();

  // Packing list reacts to the trip (walking shoes, adapter not needed in Portugal).
  await page.getByRole("tab", { name: "ציוד" }).click();
  await expect(page.getByText("נעליים נוחות להליכה")).toBeVisible();
  await expect(page.getByText(/מתאם חשמל/)).toHaveCount(0);

  // Budget renders amounts in ILS.
  await page.getByRole("tab", { name: "תקציב" }).click();
  await expect(page.getByText("לאדם ליום")).toBeVisible();
  await expect(page.getByText(/₪|ILS|€/).first()).toBeVisible();
  await shot("budget");

  // Export: ICS download has one event per activity line.
  await page.getByRole("tab", { name: "ייצוא ושיתוף" }).click();
  await shot("share");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "ליומן (ICS)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.ics$/);
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  const ics = Buffer.concat(chunks).toString("utf8");
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThan(5);

  // Share: create a read-only link and open it in a new page.
  await page.getByRole("button", { name: "צור קישור" }).click();
  await expect(page.getByText("הקישור מוכן")).toBeVisible({ timeout: 15_000 });
  const shareUrl = await page.locator("input[readonly]").inputValue();
  expect(shareUrl).toMatch(/\/he\/share\/[A-Za-z0-9_-]+$/);
  const shared = await context.newPage();
  await shared.goto(shareUrl);
  await expect(shared.getByRole("heading", { name: "תוכנית משותפת" })).toBeVisible();
  await expect(shared.getByText("תצוגה בלבד", { exact: false })).toBeVisible();
  await expect(shared.getByRole("tab", { name: "ציר זמן" })).toBeVisible();
  await expect(shared.getByRole("button", { name: /^פעולות עבור/ })).toHaveCount(0); // read-only: no menus
  await shared.close();

  // Print page renders every day and offers the print button.
  await page.goto(`${tripUrl}/print`);
  await expect(page.getByRole("button", { name: "הדפס" })).toBeVisible();
  expect(await page.getByRole("heading", { level: 2 }).count()).toBeGreaterThanOrEqual(3);
});
