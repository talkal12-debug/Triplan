# Triplan

Trip planning PWA: answer a 3-minute questionnaire, get a day-by-day, hour-by-hour itinerary
that respects your pace, ages, transport, hotel and opening hours. Hebrew-first, RTL, works offline.

See [PLAN.md](./PLAN.md) for architecture, data model, milestones and decisions (Hebrew).

## Requirements

- Node.js 20+ (developed on 24)
- npm 10+

## Setup

```bash
npm install
cp .env.example .env.local   # every variable is optional
npm run dev
```

Open http://localhost:3000 — you are redirected to `/he` (Hebrew, RTL). English is at `/en`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack). Service worker is disabled in dev. |
| `npm run build` | Production build (webpack) + generates `public/sw.js`. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint, including the RTL rule that bans physical `ml-`/`mr-`/`left-`/`right-` utilities. |
| `npm run typecheck` | `tsc --noEmit` (strict, no `any`). |
| `npm test` | Vitest unit tests. |
| `npm run i18n:check` | Fails if any `messages/*.json` is missing or has extra keys vs `he.json`. |
| `npm run check` | lint + typecheck + i18n:check + test. |
| `npm run test:e2e` | Playwright end-to-end tests (phone + desktop Chromium). Starts `next dev` if needed; first run: `npx playwright install chromium`. |
| `npm run db:push` | Create / update the local SQLite schema (`prisma/dev.db`). |
| `npm run db:seed` | Load `data/countries.json` and `data/pois/*.json` into the database (idempotent). |
| `npm run db:reset` | Drop and recreate the local database, then seed. |
| `npm run db:studio` | Browse the database in Prisma Studio. |
| `npm run data:countries` | Rebuild `data/countries.json` from mledoze/countries + Wikidata. |
| `npm run data:pois [CC] [id,id]` | Resolve the curated POI lists against OpenStreetMap into `data/pois/{cc}.json`. |

## Environment variables

All optional. Without any key the app runs in **demo mode** (banner shown).

| Variable | Used for | Milestone |
|---|---|---|
| `DATABASE_URL` | Prisma. SQLite file in dev, PostgreSQL in production. | 2 |
| `NEXT_PUBLIC_DEMO_MODE` | Force the demo banner `true`/`false`. | 1 |
| `GOOGLE_PLACES_API_KEY` | Better POI data than OpenStreetMap. | 6 |
| `ANTHROPIC_API_KEY` | Free-text itinerary editing chat. | 8 |
| `AFFILIATE_BOOKING_AID`, `AFFILIATE_GETYOURGUIDE_PARTNER_ID` | Affiliate deep links. | 6 |
| `AUTH_*` | Google + email magic-link sign-in. | 8 |

## Planning engine

`src/lib/planner/` is pure TypeScript (no React, DB or network): `generateItinerary({ prefs, places, cities, weather?, holidays? })`
returns a validated `Itinerary`. Pipeline: budgets -> filter + score -> DBSCAN clusters -> stays (single base with day
trips, or moving route) -> clusters to days -> weather + variety passes -> timed schedule (opening hours, lunch, rests,
walking cap) -> validate + repair. Editing ops live in `edit.ts`. Try it: `npx tsx scripts/smoke-plan.ts PT 6`.

## Offline (PWA)

`next build` generates `public/sw.js` (Serwist). Pages are network-first with a cached fallback and `/offline`;
OpenFreeMap tiles, sprites and glyphs are cache-first. "Download for offline" on a trip pre-caches the map around
every day's stops (zoom 12-14). The service worker is disabled in `next dev`; test offline behaviour against
`npm run build && npm start`.

## Providers

`src/lib/providers/` has one interface per category with a real, key-less implementation and an offline mock;
`registry.ts` picks by environment (`TRIPLAN_OFFLINE=true` forces the mocks). A failing provider never breaks a plan:
the caller falls back and the plan says which data is estimated.

| Category | Real | Mock |
|---|---|---|
| Routing (walk / bike / car) | OSRM table API on the FOSSGIS demo servers | straight line × 1.3 |
| Weather | Open-Meteo forecast (16 days) or archive (same dates last year, labelled) | none |
| Public holidays | Nager.Date | fixed dates for the demo countries |
| Currency | Frankfurter (ECB) | rough fixed rates |
| Cities + attractions outside the demo countries | Nominatim + Overpass, cached in the DB for 30 days | curated seed |
| Hotel / ticket / flight links | URL builders in `affiliate.ts`, affiliate ids from env | same URLs without ids |

## Data

All data ships with the repo, so the app runs fully offline and without keys.

| File | Contents | Source |
|---|---|---|
| `data/countries.json` | 250 countries: names in 11 languages incl. Hebrew, flag, currencies, languages, driving side, calling code, time zones, capital, coordinates | [mledoze/countries](https://github.com/mledoze/countries) (ODbL) + Wikidata |
| `data/country-extras.json` | Plug type, voltage, emergency numbers, tap water, tipping. Demo destinations only, each entry lists its sources | IEC World Plugs, official authorities |
| `data/pois/{pt,it,jp}.json` | ~200 curated attractions for Lisbon, Sintra/Cascais, Porto, Rome, Tivoli, Tokyo and Kamakura/Hakone | Editorial list in `scripts/pois/*.ts` + coordinates, opening hours, accessibility from OpenStreetMap (ODbL) |

`dataQuality` on every place: `verified` (found on OSM with opening hours), `partial` (found, no hours), `unverified` (not found; approximate coordinates). The UI shows a "not verified" warning for anything below `verified`.

Rebuilding the data needs the network (`npm run data:countries`, `npm run data:pois`) but the app itself never does.

## Stack

Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, shadcn/ui (Radix, RTL), Framer Motion,
next-intl, Prisma, Zod, MapLibre GL, Serwist (PWA), Vitest, Playwright.

## i18n

- Messages live in `messages/{locale}.json`. `he.json` is the reference.
- Only logical CSS properties are allowed (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`). ESLint enforces it.
- Locales beyond `he` and `en` arrive in milestone 8 and are machine-translated by Claude; they are
  marked as needing a native-speaker review.

## Status

Milestones 1-7 done (foundation, data, wizard, engine, plan views, providers, export/share/offline/tools). Next: milestone 8 (12 languages, auth, collaboration, profile, journal, gallery, AI chat, Lighthouse). See PLAN.md sections 8 and 11.
