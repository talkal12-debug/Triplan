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
| `npm run lighthouse` | Lighthouse (mobile) scores for a few pages against a production build (`npm run build` first). Uses Playwright's Chromium. |
| `npm run db:push` | Create / update the local SQLite schema (`prisma/dev.db`). |
| `npm run db:seed` | Load `data/countries.json` and `data/pois/*.json` into the database (idempotent). |
| `npm run db:reset` | Drop and recreate the local database, then seed. |
| `npm run db:studio` | Browse the database in Prisma Studio. |
| `npm run data:countries` | Rebuild `data/countries.json` from mledoze/countries + Wikidata. |
| `npm run data:pois [CC] [id,id]` | Resolve the curated POI lists against OpenStreetMap into `data/pois/{cc}.json`. |
| `npm run data:templates` | Rebuild the gallery plans in `data/templates/` by calling the planner of a running `npm run dev`. |
| `npm run data:flags` | Download all country flags (flagcdn.com, public domain) into `public/flags/` so the app serves them itself. |
| `npm run data:airports` | Rebuild `data/airports.json` (OurAirports, public domain): airports with IATA codes for flight deep links. |
| `npm run data:summaries [CC] [--refresh-plain]` | Fill in the Hebrew + English description of every curated attraction (`summary`) from Wikipedia / Wikidata. Paced, because Wikimedia rate-limits (HTTP 429); run one country at a time, and `--refresh-plain` re-fetches entries that only got the short Wikidata description. |

## Environment variables

All optional. Without any key the app runs in **demo mode** (banner shown).

| Variable | Used for | Milestone |
|---|---|---|
| `DATABASE_URL` | Prisma. SQLite file in dev, PostgreSQL in production. | 2 |
| `NEXT_PUBLIC_DEMO_MODE` | Force the demo banner `true`/`false`. | 1 |
| `GOOGLE_PLACES_API_KEY` | Better POI data than OpenStreetMap. | 6 |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | The AI assistant tab (structured plan edits). Model defaults to `claude-sonnet-5`. | 8c |
| `TICKETMASTER_API_KEY` | Real events (concerts, shows, sport) on each evening of the trip, Ticketmaster Discovery API (free developer key). Without it the evening block shows date-bound search links. | 11 |
| `ANTHROPIC_TRANSLATE_MODEL` | Model for translating place descriptions into the UI language when Wikipedia has none (needs `ANTHROPIC_API_KEY`). Defaults to `claude-haiku-4-5-20251001`. | 10 |
| `AFFILIATE_BOOKING_AID`, `AFFILIATE_GETYOURGUIDE_PARTNER_ID` | Affiliate deep links. | 6 |
| `AUTH_SECRET` | Auth.js session signing. Required in production; dev has a fixed fallback. | 8b |
| `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM` | Email magic links via Resend. Without them the link is shown on screen (demo mode, see below). | 8b |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | "Continue with Google". The button appears only when both are set. | 8b |
| `AUTH_DEMO_LOGIN` | `true` keeps the on-screen magic link in production. Never on a public site. | 8b |

## Accounts (milestone 8b)

- Guest mode stays the default: trips live in `localStorage` and every view reads from there, so the app works offline.
- Sign-in is passwordless (Auth.js v5, database sessions in SQLite/PostgreSQL). With no email service configured, the
  sign-in page shows the magic link itself ("demo mode"). That is only enabled outside production, or with `AUTH_DEMO_LOGIN=true`.
- On sign-in, `TripSync` (mounted in the layout) uploads every guest trip to the account (`POST /api/trips`), pulls the
  account's trips and merges the newer copy into `localStorage`. Afterwards every local edit is uploaded (debounced),
  deletions are mirrored. Last write wins; there is no real-time collaboration yet (8c).
- `/profile`: name + the questionnaire answers that repeat (party, pace, transport, interests, budget, stay). A fresh
  wizard starts from them. Works for guests too (`triplan:profile` in `localStorage`); members get it synced.
- "Already visited" in an attraction's menu removes it from the plan and from future plans (`/api/visited`).
- Journal tab under the plan: a note and a 1-5 rating per day, saved with the trip, never included in share links.
- Gallery: ready-made plans in `data/templates/*.json`, built by `npm run data:templates` against a running dev server.
  "Copy to my trips" shifts the dates to the same weekday at least four weeks ahead and drops stale weather/holidays.

## Planning together (milestone 8c)

- The owner creates an invite link in the "Travel partners" tab (`/api/trips/:id/collab`, action `invite`), choosing
  editor or viewer; the link can be rotated or revoked. Opening `/join/<token>` while signed in joins the trip.
- Members see the trip in "My trips" with a "shared by" badge; viewers get the read-only plan. Votes (thumbs on every
  attraction) and comments (per trip or per day) live in the `Vote` and `Comment` tables.
- No real-time: the open trip polls every 30 s. A save that is older than the server copy is rejected as `stale` and the
  client pulls the newer one (last write wins).

## AI assistant (milestone 8c)

- `POST /api/chat` sends a compact view of the plan (`src/lib/chat/compact.ts`) to Claude with one tool,
  `propose_edits`, whose output is a list of the same `EditOp` objects the buttons use. Ids that do not exist in the plan
  are dropped server-side; the client applies the rest through `/api/plan/edit`, one by one.
- Needs `ANTHROPIC_API_KEY` (`ANTHROPIC_MODEL` overrides the default `claude-sonnet-5`). Without it, `GET /api/chat`
  reports `enabled: false` and the tab explains that a key is needed. The provider call is not covered by tests (no key
  in CI); the compaction and the no-key state are.

## Booking links, affiliate programs and navigation (milestone 9)

- Every outbound link is built in `src/lib/providers/affiliate.ts` and deep-links into the partner's search for the
  trip: English city name, dates, adults and children's ages. Flights start from the city entered in the dates step
  (Hebrew UI defaults to Tel Aviv); car rental links (Rentalcars, Discover Cars) appear when the traveller chose a car.
  Verified against the live sites: Agoda gets its city page (its text search redirects home), Skyscanner gets airport
  codes (nearest large airport from `data/airports.json`; without codes only Kiwi is offered).
- Links carry `LINKS_VERSION`; a trip saved with an older version refreshes its links on open via `POST /api/plan/links`.
- Affiliate tracking: six partners have dedicated env vars, every partner accepts `AFFILIATE_QUERY_<PROVIDER>` with
  the raw tracking query from its link generator. Sign-up links and what to paste: `docs/affiliates.md` (Hebrew).
  `/disclosure` lists every partner with a one-line description and whether its link currently carries a tracking id.
- Each link has a one-line explanation (tooltip and the "What are these sites?" block under the links), in 12 languages.
- Every day has "Navigate the day in Google Maps": a Directions URL from the hotel through the stops in order (Google
  accepts 9 waypoints; longer days are truncated with a note). The day map draws straight lines first, then replaces
  them with the street route from `POST /api/route` (OSRM foot/bike/car); transit days get walking geometry.

## Place descriptions (milestone 10)

Every attraction card shows one or two sentences about the place. The text is never generated: it is the lead of the Wikipedia article linked from the place's Wikidata item (with a "(Wikipedia)" link to the article, CC BY-SA), or, when there is no article in that language, the short Wikidata description. A place with neither shows only its category.

- The curated demo places ship with Hebrew and English descriptions (`npm run data:summaries`). Where Hebrew Wikipedia has no article, the Hebrew text is a translation of the English lead, marked "(machine translation, Wikipedia)" and linked to the English article.
- Any other language: Wikipedia in that language first; otherwise, with `ANTHROPIC_API_KEY`, the English lead is translated on demand (marked as such, cached in the database); otherwise the English text is shown with a "Translate with Google" link, which needs no key.
- Other languages, places found on OpenStreetMap at plan time, and plans saved before this feature existed are filled in on demand: the planner asks for the UI language (plus English as fallback) when it builds or edits a plan, and the trip page calls `POST /api/places/summaries` for anything still missing. Results are remembered in the `Place.summary` column.
- Wikimedia rate-limits eager clients, so requests are paced (50 Wikidata items per call, Wikipedia pages one after another, back-off on 429). A plan with 40 new places takes a few seconds to fill in; the page renders immediately without waiting.

## Must-see list, restaurants and evenings (milestone 11)

- **Must-see list**: step 2 of the wizard. Catalogue places are suggested while typing (`GET /api/places/suggest`); any other name is kept as text and resolved when the plan is built: catalogue name match first, then a Nominatim lookup inside the trip's first city (an `unverified` entry, source `user`). Wished places outrank everything in scoring, bypass the soft filters (already seen, price, kids) and are marked "On your must-see list" on the card. A wish that never fits (closed on the dates) or cannot be located produces a plan warning instead of a silent drop.
- **Restaurants near every meal**: one Overpass request per plan fetches restaurants/cafes within 500 m of the stop before each lunch and within 900 m of each hotel for dinner (`src/lib/providers/nearby.ts`). Entries are ranked by how complete their OSM record is (website, opening hours, cuisine, Wikidata) and shown with a map link, plus a Google Maps search for ratings we do not have. Fast food only for the budget level.
- **Evenings**: the interests step asks for an evening style (relaxed / culture / nightlife / none). Each day gets an evening block: dinner near the hotel, venues for the style within 1.5 km (viewpoints and wine bars, theatres and live music, or bars and clubs), real events on that date when `TICKETMASTER_API_KEY` is set, and search links (GetYourGuide/Viator evening tours, Eventbrite, Songkick, Ticketmaster, Resident Advisor) built by the same link builder as the booking links.
- Plans saved before this milestone get their restaurants and evenings on next open through the links refresh (`LINKS_VERSION` 3).

## Performance notes

- `npm run lighthouse` (median of 3 mobile runs, `LIGHTHOUSE_RUNS` to change) against `npm run build && next start`.
- Things that mattered: per-primitive `@radix-ui/react-*` imports (the `radix-ui` umbrella pulled 160 KB into every
  page), CSS step transitions instead of Framer Motion, one chunk per wizard step, per-page message namespaces
  (`src/i18n/page-messages.tsx`), self-hosted flags in fixed-size boxes, no prefetch on navigation links, inlined CSS,
  and a server-rendered country index with 24 visible rows.
- `content-visibility: auto` on grid rows made the page overflow horizontally in RTL; `tests/e2e/locales.spec.ts`
  now fails on any horizontal overflow.

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
| `data/pois/{pt,it,jp}.json` | ~200 curated attractions for Lisbon, Sintra/Cascais, Porto, Rome, Tivoli, Tokyo and Kamakura/Hakone | Editorial list in `scripts/pois/*.ts` + coordinates, opening hours, accessibility from OpenStreetMap (ODbL); one-line description per place (`summary`, he + en) from Wikipedia (CC BY-SA, linked) or Wikidata |

| `data/templates/*.json` | 4 ready-made plans for the gallery (preferences + full plan snapshot) | Generated by `npm run data:templates` with the planner and real providers |
| `data/airports.json` | 3,244 commercial airports with IATA codes and coordinates, for Skyscanner-style flight links | [OurAirports](https://ourairports.com/data/) (public domain) |

`dataQuality` on every place: `verified` (found on OSM with opening hours), `partial` (found, no hours), `unverified` (not found; approximate coordinates). The UI shows a "not verified" warning for anything below `verified`.

Rebuilding the data needs the network (`npm run data:countries`, `npm run data:pois`) but the app itself never does.

## Stack

Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, shadcn/ui (Radix, RTL), Framer Motion,
next-intl, Prisma, Zod, MapLibre GL, Serwist (PWA), Vitest, Playwright.

## i18n

- Messages live in `messages/{locale}.json`. `he.json` is the reference.
- Only logical CSS properties are allowed (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`). ESLint enforces it.
- 12 locales: `he` (default, RTL), `en`, `ar` (RTL), `ru`, `es`, `fr`, `de`, `it`, `pt`, `zh-CN`, `ja`, `hi`.
  The list lives in `src/lib/i18n/locales.ts`; routing is `/{locale}/...` with `Accept-Language` detection.
- `he` and `en` are hand-written. The other ten were translated by Claude from `en.json` and **need a
  native-speaker review** before launching to that audience.
- Fonts: Rubik (latin, hebrew, arabic, cyrillic). CJK and Devanagari fall back to system fonts named in `globals.css`.
- Distance units (km / miles) are a separate toggle in the language menu, stored in `localStorage` (`triplan:units`).
  Conversion happens only at display time (`src/lib/units/`); the engine and exports stay metric.
- `tests/e2e/locales.spec.ts` opens the home page and the wizard in every locale, checks `<html lang dir>`,
  RTL layout and that next-intl logs no missing-message errors.

## Status

All planned milestones are done (1-7, 8a, 8b, 8c): foundation, data, wizard, engine, plan views, providers, export/share/offline/tools, 12 languages + units toggle, accounts + sync, profile, visited archive, journal, gallery, planning together, AI assistant (needs a key), performance pass. Open items: Lighthouse performance on the wizard (~79 on a simulated slow phone), native-speaker review of the 10 machine-translated locales, deployment (Vercel + PostgreSQL). See PLAN.md sections 8, 9 and 11.
