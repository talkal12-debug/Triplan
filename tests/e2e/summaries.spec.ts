import { expect, test } from "@playwright/test";

/**
 * Milestone 10: every attraction card carries a one-line description of the
 * place (Wikipedia / Wikidata, never generated). Plans saved before this
 * existed get their descriptions on open, without re-planning.
 */
test("attraction cards show a description line, also for older plans from the gallery", async ({ page }) => {
  test.setTimeout(180_000);
  // Gallery templates were generated before milestone 10: their places have no summaries.
  await page.goto("/he/gallery");
  await page.getByRole("listitem").filter({ hasText: "ליסבון" }).first().getByRole("button", { name: "העתק לטיולים שלי" }).click();
  await expect(page).toHaveURL(/\/he\/trip\/g_/, { timeout: 90_000 });
  await expect(page.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 90_000 });

  // A Wikipedia-backed description appears under the place name, with its source link.
  const source = page.getByRole("link", { name: "(ויקיפדיה)" }).first();
  await expect(source).toBeVisible({ timeout: 60_000 });
  expect(await source.getAttribute("href")).toMatch(/^https:\/\/(he|en)\.wikipedia\.org\/wiki\//);
  const text = await source.locator("..").innerText();
  expect(text.replace("(ויקיפדיה)", "").trim().length).toBeGreaterThan(20);
  // Day 1 is the arrival day with a single stop; day 2 has several cards, each with its line.
  const day2 = page.getByRole("tab", { name: /^יום 2/ });
  await day2.dispatchEvent("mousedown");
  await day2.click();
  await expect(day2).toHaveAttribute("aria-selected", "true");
  await expect.poll(async () => page.locator("p.text-sm.leading-snug.text-muted-foreground").count()).toBeGreaterThanOrEqual(3);
});
