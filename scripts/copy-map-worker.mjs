import { copyFileSync, mkdirSync } from "node:fs";
// MapLibre parses tiles in a module worker that imports a shared chunk. Both are served
// as static files so the worker loads the same way under Turbopack, webpack and the service worker.
mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `public/maplibre/${f}`);
}
