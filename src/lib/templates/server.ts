import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { summarize, templateSchema, type TemplateSummary, type TripTemplate } from "./schema";

const dir = join(process.cwd(), "data", "templates");

let cache: TripTemplate[] | undefined;

/** All committed templates, validated once per process. Missing folder = empty gallery, not a crash. */
export function listTemplates(): TripTemplate[] {
  if (!cache) {
    cache = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".json"))
          .sort()
          .map((f) => templateSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))))
      : [];
  }
  return cache;
}

export function listTemplateSummaries(): TemplateSummary[] {
  return listTemplates().map(summarize);
}

export function getTemplate(id: string): TripTemplate | undefined {
  return listTemplates().find((t) => t.id === id);
}
