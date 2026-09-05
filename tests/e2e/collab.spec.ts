import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Two people plan together: the owner copies a gallery plan, signs in and
 * creates an invite link; a second person (separate browser context) signs in,
 * joins, votes and comments; the owner sees both after the next poll.
 * Also checks the AI assistant's honest "needs a key" state.
 */
async function signIn(page: Page, email: string) {
  await page.goto("/he/signin");
  await page.getByLabel("כתובת מייל").fill(email);
  await page.getByRole("button", { name: "שלחו לי קישור כניסה" }).click();
  await page.getByRole("link", { name: "פתחו את קישור הכניסה" }).click();
  await expect(page.getByRole("button", { name: "החשבון שלי" })).toBeVisible({ timeout: 30_000 });
}

async function openTools(page: Page, tab: string) {
  await page.getByRole("tab", { name: tab }).dispatchEvent("mousedown");
}

test("owner invites a partner who votes and comments", async ({ browser }: { browser: Browser }) => {
  test.setTimeout(300_000);
  const stamp = Date.now();
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();

  // Owner: a trip from the gallery, then sign in (the trip moves into the account).
  await owner.goto("/he/gallery");
  await owner.getByRole("listitem").filter({ hasText: "ליסבון וסינטרה עם ילדים" }).getByRole("button", { name: "העתק לטיולים שלי" }).click();
  await expect(owner).toHaveURL(/\/he\/trip\/g_/, { timeout: 90_000 });
  const tripUrl = owner.url();
  await signIn(owner, `owner-${stamp}@example.com`);
  await owner.goto(tripUrl);
  await expect(owner.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 60_000 });

  // AI assistant without a key says so instead of pretending.
  await openTools(owner, "עוזר AI");
  await expect(owner.getByText("העוזר דורש מפתח Anthropic")).toBeVisible();

  // Invite link.
  await openTools(owner, "שותפים");
  await owner.getByRole("button", { name: "צור קישור הזמנה" }).click({ timeout: 30_000 });
  const inviteUrl = (await owner.locator("p[dir=ltr]").filter({ hasText: "/join/" }).textContent())?.trim();
  expect(inviteUrl).toMatch(/\/he\/join\//);

  // Partner: separate browser, signs in, joins.
  const partnerCtx = await browser.newContext();
  const partner = await partnerCtx.newPage();
  await signIn(partner, `partner-${stamp}@example.com`);
  await partner.goto(inviteUrl!);
  await expect(partner.getByRole("heading", { name: "הזמנה לטיול" })).toBeVisible();
  await partner.getByRole("button", { name: "הצטרף לטיול" }).click();
  await expect(partner).toHaveURL(/\/he\/trip\/g_/, { timeout: 60_000 });
  await expect(partner.getByText(/שותף על ידי/)).toBeVisible({ timeout: 30_000 });
  await expect(partner.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 60_000 });

  // Partner votes on the first stop and leaves a comment.
  const up = partner.getByRole("button", { name: "בעד" }).first();
  await expect(up).toBeVisible({ timeout: 40_000 });
  await up.click();
  await expect(up).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await openTools(partner, "שותפים");
  await partner.getByPlaceholder("כתבו הערה לשותפים...").fill("בואו נתחיל מאוחר יותר ביום 1");
  await partner.getByRole("button", { name: "שלח" }).click();
  await expect(partner.getByText("בואו נתחיל מאוחר יותר ביום 1")).toBeVisible({ timeout: 15_000 });

  // Owner sees the partner, the vote and the comment.
  await owner.reload();
  await expect(owner.getByRole("tab", { name: "ציר זמן" })).toBeVisible({ timeout: 60_000 });
  await expect(owner.getByRole("button", { name: "בעד" }).first()).toHaveText(/1/, { timeout: 40_000 });
  await openTools(owner, "שותפים");
  await expect(owner.getByText("בואו נתחיל מאוחר יותר ביום 1")).toBeVisible({ timeout: 15_000 });
  expect(await owner.getByRole("listitem").filter({ hasText: /עורך|בעלים/ }).count()).toBeGreaterThanOrEqual(2);

  await ownerCtx.close();
  await partnerCtx.close();
});
