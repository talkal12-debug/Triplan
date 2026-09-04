/**
 * Offline smoke test against a production server (service worker enabled).
 * Usage: npm run build && npm start   (in another terminal)   then: node scripts/verify-offline.mjs
 * Steps: open a trip page online (SW installs), go offline, reload: page + saved plan still render,
 * then a never-visited page falls back to /offline.
 */
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const context = await browser.newContext({ locale: "he-IL" });
const page = await context.newPage();

// 1. Seed a guest trip through the wizard and build it (network on).
await page.goto(`${base}/he/plan/destination`);
await page.getByRole("checkbox", { name: "בחר את פורטוגל" }).click();
await page.getByRole("checkbox", { name: /ליסבון/ }).click();
const next = page.getByRole("button", { name: "המשך" });
await next.click();
for (const step of ["dates", "party", "visit", "pace", "transport", "interests", "budget", "hotel"]) {
  await page.waitForURL(new RegExp(`/plan/${step}$`));
  await next.click();
}
await page.waitForURL(/\/plan\/summary$/);
await page.getByRole("button", { name: "בנה לי טיול" }).click();
await page.waitForURL(/\/he\/trip\/g_/);
await page.getByRole("button", { name: "בנה תוכנית" }).click();
await page.getByRole("tab", { name: "ציר זמן" }).waitFor({ timeout: 150_000 });
const tripUrl = page.url();

// 2. Wait for the service worker to control the page, then pre-cache the map.
await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30_000 });
await page.getByRole("tab", { name: "ייצוא ושיתוף" }).click();
await page.getByRole("button", { name: "הורד למצב אופליין" }).click();
await page.getByText(/שמורות במכשיר/).waitFor({ timeout: 120_000 });
const tilesText = await page.getByText(/שמורות במכשיר/).textContent();
// Visit the trips list and the map tab once so their chunks are cached.
await page.goto(`${base}/he/trips`);
await page.goto(tripUrl);
await page.getByRole("tab", { name: "מפה" }).click();
await page.waitForFunction(() => window.__triplanMap?.loaded?.() === true, null, { timeout: 30_000 }).catch(() => {});

// 3. Offline: reload the trip page, the plan and the map must still render.
await context.setOffline(true);
await page.reload();
await page.getByRole("tab", { name: "ציר זמן" }).waitFor({ timeout: 30_000 });
const stops = await page.getByRole("button", { name: /^פעולות עבור/ }).count();
await page.getByRole("tab", { name: "מפה" }).click();
await page.locator("canvas.maplibregl-canvas").waitFor({ timeout: 20_000 });
await page.waitForTimeout(2500);
const mapLoaded = await page.evaluate(() => window.__triplanMap?.loaded?.() === true);
await page.screenshot({ path: "test-results/offline-map.png" });

// 4. A page never visited falls back to the offline page.
await page.goto(`${base}/he/gallery`).catch(() => {});
const offlineText = await page.textContent("body").catch(() => "");

await browser.close();
console.log(JSON.stringify({ tilesText, stopsOffline: stops, mapLoadedOffline: mapLoaded, fallbackShown: /אין חיבור לאינטרנט/.test(offlineText ?? "") }, null, 2));
if (stops === 0 || !/אין חיבור/.test(offlineText ?? "")) process.exit(1);
