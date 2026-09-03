/**
 * Verifies every messages/{locale}.json has exactly the same keys as the
 * reference locale (he). Exits 1 on any missing or extra key, so CI fails.
 *
 * Usage: npm run i18n:check
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const messagesDir = join(process.cwd(), "messages");
const reference = "he";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flatten(value, path);
  });
}

function load(locale: string): Tree {
  return JSON.parse(readFileSync(join(messagesDir, `${locale}.json`), "utf8")) as Tree;
}

const refKeys = new Set(flatten(load(reference)));
const locales = readdirSync(messagesDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .filter((l) => l !== reference);

let failed = false;

for (const locale of locales) {
  const keys = new Set(flatten(load(locale)));
  const missing = [...refKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !refKeys.has(k));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n[i18n] ${locale}.json`);
    for (const k of missing) console.error(`  missing: ${k}`);
    for (const k of extra) console.error(`  extra:   ${k}`);
  } else {
    console.log(`[i18n] ${locale}.json OK (${keys.size} keys)`);
  }
}

if (failed) {
  console.error("\n[i18n] FAILED");
  process.exit(1);
}
console.log(`[i18n] all ${locales.length + 1} locales in sync (${refKeys.size} keys)`);
