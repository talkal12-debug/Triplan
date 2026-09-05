import { expect, test } from "@playwright/test";
import { localeDir, locales } from "../../src/lib/i18n/locales";

/**
 * Smoke test over every supported UI language: the home page and the first
 * wizard step render, <html lang/dir> match the locale, and next-intl reports
 * no missing or malformed messages in the browser console.
 */
for (const locale of locales) {
  test(`locale ${locale}: home and wizard render with correct direction`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const intlErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (/MISSING_MESSAGE|INVALID_MESSAGE|IntlError|INSUFFICIENT_PATH/.test(text)) intlErrors.push(text);
    });
    page.on("pageerror", (err) => intlErrors.push(`pageerror: ${err.message}`));

    await page.goto(`/${locale}`);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", locale);
    await expect(html).toHaveAttribute("dir", localeDir[locale]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The CTA must lead into the localized wizard.
    await page.getByRole("main").getByRole("link").first().click();
    // First hit of the wizard route on a cold dev server compiles it (no prefetch on nav links any more).
    await expect(page).toHaveURL(new RegExp(`/${locale}/plan/destination$`), { timeout: 90_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeVisible();

    // RTL locales must lay the country cards out from the right: the flag (first
    // child of the full-width checkbox button) sits on the inline-start side.
    const card = page.getByRole("checkbox").first();
    const cardBox = await card.boundingBox();
    const flagBox = await card.locator(":scope > *").first().boundingBox();
    expect(cardBox && flagBox).toBeTruthy();
    if (cardBox && flagBox) {
      const isRtl = localeDir[locale] === "rtl";
      const flagCenter = flagBox.x + flagBox.width / 2;
      const cardCenter = cardBox.x + cardBox.width / 2;
      expect(isRtl ? flagCenter > cardCenter : flagCenter < cardCenter, `${locale}: flag should sit at the ${isRtl ? "right" : "left"} edge of the card`).toBe(true);
    }

    // No horizontal overflow: an element wider than the viewport makes the whole page scroll sideways in RTL.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${locale}: wizard page overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(0);

    expect(intlErrors, `${locale}: ${intlErrors.join("\n")}`).toEqual([]);
    if (testInfo.project.name === "desktop-chromium" && (locale === "ar" || locale === "ja" || locale === "hi")) {
      await page.screenshot({ path: testInfo.outputPath(`${locale}-wizard.png`), fullPage: false });
    }
  });
}
