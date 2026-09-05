import { expect, test } from "@playwright/test";

/**
 * Milestone 11: a must-see list at the start of the wizard, restaurants around
 * every meal, and an evening block per day in the traveller's style.
 */
test("wishlist places are planned first, meals get restaurants, evenings get venues and links", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/he/plan/destination");
  const next = page.getByRole("button", { name: "המשך" });
  await page.getByRole("checkbox", { name: /^פורטוגל / }).click();
  await page.getByRole("checkbox", { name: /ליסבון/ }).click();
  await next.click();

  // Wishlist: a catalogue suggestion and a free-text entry.
  await expect(page).toHaveURL(/\/plan\/wishlist$/);
  const input = page.getByPlaceholder(/מגדל בלם/);
  await input.fill("Ocean");
  await page.getByRole("button", { name: /Oceanário/ }).first().click();
  await expect(page.getByRole("list", { name: "רשימת החובה שלכם" })).toContainText(/Oceanário/);
  await input.fill("LX Factory");
  await page.getByRole("button", { name: "הוסף", exact: true }).click();
  await expect(page.getByRole("list", { name: "רשימת החובה שלכם" }).getByRole("listitem")).toHaveCount(2);
  // The draft survives a reload.
  await page.reload();
  await expect(page.getByRole("list", { name: "רשימת החובה שלכם" }).getByRole("listitem")).toHaveCount(2);
  await next.click();

  for (const step of ["dates", "party", "visit", "pace", "transport"]) {
    await expect(page).toHaveURL(new RegExp(`/plan/${step}$`));
    await next.click();
  }
  // Interests: evening style.
  await expect(page).toHaveURL(/\/plan\/interests$/);
  await page.getByText("חיי לילה", { exact: true }).last().click();
  await next.click();
  for (const step of ["budget", "hotel"]) {
    await expect(page).toHaveURL(new RegExp(`/plan/${step}$`));
    await next.click();
  }
  await expect(page).toHaveURL(/\/plan\/summary$/);
  await expect(page.getByText(/Oceanário/)).toBeVisible();
  await expect(page.getByText(/LX Factory/)).toBeVisible();
  await page.getByRole("button", { name: "בנה לי טיול" }).click();
  await expect(page).toHaveURL(/\/he\/trip\/g_/, { timeout: 90_000 });
  await page.getByRole("button", { name: "בנה תוכנית" }).click();
  await expect(page.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 150_000 });

  // Both wished places are in the plan and flagged.
  await page.getByRole("tab", { name: "רשימה" }).dispatchEvent("mousedown");
  await expect(page.getByText(/Oceanário/).first()).toBeVisible();
  await expect(page.getByText(/LX Factory/).first()).toBeVisible();
  await page.getByRole("tab", { name: "ציר זמן" }).dispatchEvent("mousedown");
  // Nothing from the list was dropped, and the visits carry the "must-see" reason on whichever day they landed.
  await expect(page.getByText(/מרשימת החובה לא נכנס/)).toHaveCount(0);
  const chip = page.getByText("ברשימת החובה שלכם").first();
  const dayTabs = page.getByRole("tab", { name: /^יום \d/ });
  let found = false;
  for (let i = 0; i < (await dayTabs.count()) && !found; i++) {
    const tab = dayTabs.nth(i);
    await tab.dispatchEvent("mousedown");
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    found = await chip.waitFor({ timeout: 3_000 }).then(() => true, () => false);
  }
  expect(found).toBe(true);

  // A full day: lunch has restaurants nearby (OpenStreetMap) and a Google Maps search; the evening block matches the style.
  const day2 = page.getByRole("tab", { name: /^יום 2/ });
  await day2.dispatchEvent("mousedown");
  await day2.click();
  await expect(day2).toHaveAttribute("aria-selected", "true");
  const dining = page.getByTestId("dining").first();
  await expect(dining).toBeVisible({ timeout: 60_000 });
  await expect(dining.getByRole("link", { name: /Google Maps/ })).toHaveAttribute("href", /google\.com\/maps\/search/);
  const evening = page.getByTestId("evening");
  await expect(evening).toBeVisible();
  await expect(evening).toContainText("חיי לילה");
  await expect(evening).toContainText("ארוחת ערב ליד המלון");
  await expect(evening.getByRole("link", { name: /^Resident Advisor/ })).toHaveAttribute("href", /ra\.co\/events\/pt\/lisbon/);
  // No events key in tests: the block says so instead of pretending.
  await expect(evening).toContainText(/Ticketmaster/);
});
