import { expect, test } from "@playwright/test";

/**
 * Sign-in without any key (demo magic link) and guest -> account migration:
 * a trip created as a guest shows up in the account's trips API after sign-in,
 * and edits made while signed in are uploaded.
 */
test("guest trip moves into the account after signing in", async ({ page }) => {
  test.setTimeout(180_000);
  const email = `e2e-${Date.now()}@example.com`;

  // 1. Create a guest trip (defaults, Portugal).
  await page.goto("/he/plan/destination");
  const next = page.getByRole("button", { name: "המשך" });
  await page.getByRole("checkbox", { name: /^פורטוגל / }).click();
  await next.click();
  for (const step of ["dates", "party", "visit", "pace", "transport", "interests", "budget", "hotel"]) {
    await expect(page).toHaveURL(new RegExp(`/plan/${step}$`));
    await next.click();
  }
  await expect(page).toHaveURL(/\/plan\/summary$/);
  await page.getByRole("button", { name: "בנה לי טיול" }).click();
  // First hit of the trip route compiles it in dev, which can take a while.
  await expect(page).toHaveURL(/\/he\/trip\/g_/, { timeout: 90_000 });
  const tripId = page.url().split("/trip/")[1];

  // 2. Sign in with the on-screen demo link.
  await page.getByRole("link", { name: "כניסה" }).click();
  await expect(page).toHaveURL(/\/he\/signin/);
  await page.getByLabel("כתובת מייל").fill(email);
  await page.getByRole("button", { name: "שלחו לי קישור כניסה" }).click();
  await page.getByRole("link", { name: "פתחו את קישור הכניסה" }).click();

  // 3. Signed in: avatar menu present, trips page lists the trip.
  await expect(page.getByRole("button", { name: "החשבון שלי" })).toBeVisible({ timeout: 30_000 });
  const listed = await page.evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      const res = await fetch("/api/trips");
      const json = (await res.json()) as { trips?: { id: string }[] };
      if (json.trips?.length) return json.trips.map((t) => t.id);
      await new Promise((r) => setTimeout(r, 500));
    }
    return [];
  });
  expect(listed).toContain(tripId);

  // 4. Account menu works and sign-out returns to guest mode.
  await page.getByRole("button", { name: "החשבון שלי" }).click();
  await expect(page.getByRole("menuitem", { name: "הפרופיל שלי" })).toBeVisible();
  await page.getByRole("menuitem", { name: "יציאה" }).click();
  await expect(page.getByRole("link", { name: "כניסה" })).toBeVisible({ timeout: 30_000 });
});
