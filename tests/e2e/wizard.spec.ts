import { expect, test } from "@playwright/test";

/**
 * Walks through the whole questionnaire in Hebrew (RTL) with mostly default
 * answers, builds a guest trip and checks it was saved on the device.
 */
test("guest can complete the wizard and land on a saved trip", async ({ page }) => {
  await page.goto("/he/plan");
  await expect(page).toHaveURL(/\/he\/plan\/destination$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  // Step 1: destination is required, then pick Portugal + Lisbon.
  const next = page.getByRole("button", { name: "המשך" });
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox", { name: /^פורטוגל / }).click();
  await page.getByRole("checkbox", { name: /ליסבון/ }).click();
  // Countries without a curated seed are selectable too (OpenStreetMap), just labelled.
  await page.getByPlaceholder(/חפש מדינה/).fill("גרמניה");
  await expect(page.getByRole("checkbox", { name: /^גרמניה / })).toBeEnabled();
  await expect(page.getByRole("checkbox", { name: /^גרמניה / })).toContainText("OpenStreetMap");
  await expect(next).toBeEnabled();
  await next.click();

  // Step 2: dates (defaults are valid).
  await expect(page).toHaveURL(/\/plan\/dates$/);
  await expect(page.getByText(/עונה ביעד/)).toBeVisible();
  await next.click();

  // Step 3: travellers: add a child.
  await expect(page).toHaveURL(/\/plan\/party$/);
  await page.getByRole("button", { name: "הוסף ילדים (2–17)" }).click();
  await expect(page.getByLabel("גיל ילד/ה 1")).toBeVisible();
  await next.click();

  // Step 4: visit number: second time reveals the notes box.
  await expect(page).toHaveURL(/\/plan\/visit$/);
  await page.getByText("פעם שנייה").click();
  await expect(page.getByLabel(/מה כבר ראיתם/)).toBeVisible();
  await next.click();

  // Steps 5-8: accept defaults / skip.
  await expect(page).toHaveURL(/\/plan\/pace$/);
  await next.click();
  await expect(page).toHaveURL(/\/plan\/transport$/);
  await next.click();
  await expect(page).toHaveURL(/\/plan\/interests$/);
  await page.getByRole("checkbox", { name: "יינות" }).click();
  await next.click();
  await expect(page).toHaveURL(/\/plan\/budget$/);
  await page.getByRole("button", { name: "דלג (ברירת מחדל)" }).click();

  // Step 9: hotel shows a recommendation when "not sure".
  await expect(page).toHaveURL(/\/plan\/hotel$/);
  await expect(page.getByText(/ההמלצה שלנו/)).toBeVisible();
  await next.click();

  // Step 10: summary reflects the choices and builds a guest trip.
  await expect(page).toHaveURL(/\/plan\/summary$/);
  await expect(page.getByText("פורטוגל")).toBeVisible();
  await expect(page.getByText("פעם שנייה")).toBeVisible();
  await page.getByRole("button", { name: "בנה לי טיול" }).click();

  await expect(page).toHaveURL(/\/he\/trip\/g_/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "הטיול שלך" })).toBeVisible();
  await expect(page.getByText("נשמר במכשיר הזה (מצב אורח)")).toBeVisible();

  // The draft survived in localStorage and the trip is listed.
  const stored = await page.evaluate(() => localStorage.getItem("triplan:guest-trips"));
  expect(stored).toContain('"countryCode":"PT"');
  await page.goto("/he/trips");
  await expect(page.getByRole("link", { name: "פתח" })).toHaveCount(1);
});

test("draft is restored after reload", async ({ page }) => {
  await page.goto("/he/plan/destination");
  await page.getByRole("checkbox", { name: /^יפן / }).click();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /^יפן / })).toHaveAttribute("aria-checked", "true");
});
