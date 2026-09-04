import { expect, test } from "@playwright/test";

/**
 * Gallery clone -> plan view -> "already visited" -> journal -> profile.
 * Everything here works as a guest (no keys, no sign-in); the account only adds sync.
 */
test("gallery template can be copied, visited places and journal are kept, profile prefills", async ({ page }, testInfo) => {
  test.setTimeout(240_000);

  // Gallery lists the committed templates and copies one into "My trips".
  await page.goto("/he/gallery");
  await expect(page.getByRole("heading", { level: 1, name: "תוכניות מוכנות" })).toBeVisible();
  const cards = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "העתק לטיולים שלי" }) });
  expect(await cards.count()).toBeGreaterThanOrEqual(4);
  await cards.filter({ hasText: "רומא בפעם הראשונה" }).getByRole("button", { name: "העתק לטיולים שלי" }).click();
  await expect(page).toHaveURL(/\/he\/trip\/g_/, { timeout: 90_000 });
  await expect(page.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 60_000 });

  // "Already visited" removes the stop from the plan and remembers the place.
  const menus = page.getByRole("button", { name: /^פעולות עבור/ });
  const before = await menus.count();
  expect(before).toBeGreaterThan(0);
  await menus.first().click();
  await page.getByRole("menuitem", { name: "כבר ביקרתי כאן" }).click();
  await expect(menus).toHaveCount(before - 1, { timeout: 30_000 });
  const visited = await page.evaluate(() => JSON.parse(localStorage.getItem("triplan:profile") ?? "{}") as { visited?: unknown[] });
  expect(visited.visited?.length).toBe(1);

  // Journal: rate day 1 and write a note; both survive a reload.
  await page.getByRole("tab", { name: "יומן" }).dispatchEvent("mousedown");
  await page.getByRole("radio", { name: "4 כוכבים" }).first().click();
  await page.getByRole("textbox", { name: /^יום 1/ }).fill("פיצה מעולה ליד הפנתאון");
  await page.reload();
  await expect(page.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("tab", { name: "יומן" }).dispatchEvent("mousedown");
  await expect(page.getByRole("radio", { name: "4 כוכבים" }).first()).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("textbox", { name: /^יום 1/ })).toHaveValue("פיצה מעולה ליד הפנתאון");
  await page.screenshot({ path: testInfo.outputPath("journal.png") });

  // Profile: the visited place is listed; saving defaults prefills a fresh wizard.
  await page.goto("/he/profile");
  await expect(page.getByRole("heading", { level: 1, name: "הפרופיל שלי" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^הסר את/ })).toHaveCount(1);
  await page.getByLabel("שם", { exact: true }).fill("טל");
  await page.getByRole("radio", { name: /הרבה הליכה/ }).check({ force: true });
  await page.getByRole("button", { name: "שמור פרופיל" }).click();
  await expect(page.getByRole("button", { name: "נשמר" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("profile.png") });

  await page.evaluate(() => localStorage.removeItem("triplan:wizard-draft"));
  await page.goto("/he/plan/pace");
  await expect(page.getByRole("radio", { name: /הרבה הליכה/ })).toBeChecked({ timeout: 30_000 });
});
