/**
 * Runs Lighthouse (mobile preset) against a production server and prints the
 * four category scores per page. Chromium comes from Playwright and is driven
 * over the DevTools port, so nothing else needs to be installed.
 *
 * Usage: npm run build && npm run lighthouse
 * Starts `next start -p 3100` itself unless LIGHTHOUSE_URL points at a running server.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import lighthouse from "lighthouse";
import { chromium } from "playwright";

const base = process.env.LIGHTHOUSE_URL ?? "http://localhost:3100";
const pages = ["/he", "/en", "/ar/plan/destination", "/he/know-before"];
const outDir = join(process.cwd(), "test-results", "lighthouse");
const port = 9222;
mkdirSync(outDir, { recursive: true });

async function waitFor(url, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${url} did not come up`);
}

let server;
if (!process.env.LIGHTHOUSE_URL) {
  server = spawn("npx", ["next", "start", "-p", "3100"], { shell: true, stdio: "ignore" });
  await waitFor(`${base}/he`, 60_000);
}

const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
const results = [];
try {
  for (const path of pages) {
    const { lhr, report } = await lighthouse(`${base}${path}`, {
      port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    writeFileSync(join(outDir, `${path.replace(/[^a-z0-9]+/gi, "_")}.json`), report);
    const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
    results.push({ path, ...scores });
  }
} finally {
  await browser.close();
  if (server) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
}

console.table(results);
const worst = Math.min(...results.flatMap((r) => [r.performance, r.accessibility, r["best-practices"], r.seo]));
console.log(`lowest score: ${worst}`);
