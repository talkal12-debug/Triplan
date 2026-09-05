import { expect, test, type Page } from "@playwright/test";

/**
 * Milestone 9: every booking link opens on the trip's city and dates, car rental
 * appears when the traveller drives, each partner has a one-line explanation,
 * a day can be navigated in Google Maps, and the map draws real streets.
 */
async function buildRomeTripWithCar(page: Page) {
  await page.goto("/he/plan/destination");
  const next = page.getByRole("button", { name: "המשך" });
  await page.getByRole("checkbox", { name: /^איטליה / }).click();
  await next.click();
  await expect(page).toHaveURL(/\/plan\/dates$/);
  await page.getByLabel(/מאיפה טסים/).fill("Tel Aviv");
  await next.click();
  for (const step of ["party", "visit", "pace"]) {
    await expect(page).toHaveURL(new RegExp(`/plan/${step}$`));
    await next.click();
  }
  await expect(page).toHaveURL(/\/plan\/transport$/);
  // The switch input is visually hidden; its label toggles it.
  await page.getByText("רכב שכור", { exact: true }).click();
  await expect(page.getByRole("switch", { name: "רכב שכור" })).toBeChecked();
  await next.click();
  for (const step of ["interests", "budget", "hotel"]) {
    await expect(page).toHaveURL(new RegExp(`/plan/${step}$`));
    await next.click();
  }
  await expect(page).toHaveURL(/\/plan\/summary$/);
  await page.getByRole("button", { name: "בנה לי טיול" }).click();
  await expect(page).toHaveURL(/\/he\/trip\/g_/, { timeout: 90_000 });
  await page.getByRole("button", { name: "בנה תוכנית" }).click();
  await expect(page.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 150_000 });
}

test("booking links deep-link to the city, car rental shows for drivers, Google Maps navigates the day", async ({ page }) => {
  test.setTimeout(300_000);
  await buildRomeTripWithCar(page);

  // Hotel link: Booking opens on Rome with the stay's dates and the party.
  const booking = page.getByRole("link", { name: /^Booking\.com/ }).first();
  const bookingUrl = await booking.getAttribute("href");
  expect(bookingUrl).toContain("ss=Rome");
  expect(bookingUrl).toMatch(/checkin=\d{4}-\d{2}-\d{2}/);
  expect(bookingUrl).toContain("group_adults=2");
  expect(await booking.getAttribute("rel")).toContain("sponsored");

  // Flights from the traveller's city; car rental because the car switch is on.
  const kiwiUrl = await page.getByRole("link", { name: /^Kiwi/ }).first().getAttribute("href");
  expect(kiwiUrl).toContain("/tel-aviv/rome-italy/");
  const carUrl = await page.getByRole("link", { name: /^Rentalcars/ }).first().getAttribute("href");
  expect(carUrl).toContain("location=Rome");

  // Every partner has an explanation, with a link to the disclosure page.
  await page.getByText("מה האתרים האלה?").first().click();
  await expect(page.getByText(/אתר ההזמנות הגדול בעולם/)).toBeVisible();
  await expect(page.getByRole("link", { name: "עוד על הקישורים ועל תוכניות השותפים" })).toBeVisible();

  // Google Maps: hotel -> stops in order, real navigation.
  const nav = page.getByRole("link", { name: "נווטו את היום ב-Google Maps" }).first();
  const navUrl = await nav.getAttribute("href");
  expect(navUrl).toContain("https://www.google.com/maps/dir/?api=1");
  expect(navUrl).toMatch(/origin=\d+\.\d+(,|%2C)\d+\.\d+/);
  expect(navUrl).toContain("travelmode=");

  // Map: straight lines first, then the street route from OSRM.
  await page.getByRole("tab", { name: "מפה" }).dispatchEvent("mousedown");
  await expect(page.getByText(/רחובות אמיתיים/)).toBeVisible({ timeout: 60_000 });
});

test("disclosure page lists every partner with its status", async ({ page }) => {
  await page.goto("/he/disclosure");
  await expect(page.getByRole("heading", { name: "האתרים שאליהם אנחנו מקשרים" })).toBeVisible();
  for (const name of ["Booking.com", "Kiwi", "Rentalcars", "GetYourGuide"]) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  expect(await page.getByText("קישור רגיל, ללא עמלה").count()).toBeGreaterThanOrEqual(10);
});
