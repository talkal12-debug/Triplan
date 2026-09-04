import { expect, test } from "@playwright/test";

/**
 * A country without a curated seed (France): the wizard requires a city picked
 * through the city search. The search API is intercepted so the test needs no network.
 */
test("non-demo country needs a city from the OSM search", async ({ page }) => {
  await page.route("**/api/cities**", async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") ?? "";
    const cities = q.toLowerCase().startsWith("par")
      ? [{ slug: "osm-paris-71525", countryCode: "FR", names: { en: "Paris", he: "פריז", local: "Paris" }, center: { lat: 48.8535, lng: 2.3484 }, bbox: [48.8156, 2.2241, 48.9022, 2.4698] }]
      : [];
    await route.fulfill({ json: { cities, provider: "osm", notes: [] } });
  });

  await page.goto("/he/plan/destination");
  const next = page.getByRole("button", { name: "המשך" });
  await page.getByPlaceholder(/חפש מדינה/).fill("צרפת");
  await page.getByRole("checkbox", { name: /^צרפת / }).click();

  // Selected, but no city yet: blocked with an explanation.
  await expect(next).toBeDisabled();
  await expect(page.getByText("בחרו לפחות עיר אחת במדינה הזאת")).toBeVisible();

  await page.getByPlaceholder(/הקלידו שם עיר/).fill("Par");
  await page.getByRole("button", { name: /פריז/ }).click();
  await expect(page.getByRole("checkbox", { name: /הסר את פריז/ })).toBeVisible();
  await expect(next).toBeEnabled();

  // The pick survives a reload (draft in localStorage) and shows in the summary.
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /הסר את פריז/ })).toBeVisible();
  await page.goto("/he/plan/summary");
  await expect(page.getByText("פריז")).toBeVisible();
});
