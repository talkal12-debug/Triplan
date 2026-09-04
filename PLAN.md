# Triplan — תוכנית בנייה (PLAN.md)

> מסמך זה נכתב לפני שורת קוד אחת. הוא מתאר מה נבנה, איך, באיזה סדר, ואילו החלטות התקבלו בלי לשאול.
> תאריך: 2026-09-03. מקור הדרישות: `triplan-claude-code-prompt.md`.

---

## 1. מה זה Triplan במשפט

אפליקציית ווב (PWA) שבה ממלאים שאלון של ~3 דקות ומקבלים תוכנית טיול יומית, שעה-שעה, שמתחשבת בקצב, בגילאים, בתחבורה, במלון ובשעות הפתיחה — ניתנת לעריכה, לשיתוף, לייצוא ולשימוש אופליין.

---

## 2. בחירות טכנולוגיות (מה ולמה)

| תחום | בחירה | הערה / סטייה מהמסמך |
|---|---|---|
| Framework | **Next.js 15** (App Router) + **TypeScript strict** | כמו במסמך |
| UI | **Tailwind CSS v4** + **shadcn/ui** + **Framer Motion** | כמו במסמך |
| i18n | **next-intl** עם routing לפי locale (`/he`, `/en`, …) | כמו במסמך. ברירת מחדל: עברית |
| DB / ORM | **Prisma** + SQLite בפיתוח, **PostgreSQL** בפרודקשן | **סטייה קטנה:** לא נשתמש ב-`enum` של Prisma (תמיכה חלקית ב-SQLite). ערכים כאלה יישמרו כ-`String` ויאומתו ב-Zod |
| Auth | **Auth.js v5** (הגרסה החדשה של NextAuth) — Google + Email magic link | מצב אורח מלא קודם. הרשמה אמיתית דורשת מפתחות Google ושירות מייל (Resend) — ראה שאלות |
| Data fetching | **TanStack Query** + **Zod** על כל קלט ועל כל תשובת API חיצוני | כמו במסמך |
| מפות | **MapLibre GL** + אריחי OSM (OpenFreeMap / Carto) | כמו במסמך |
| PWA | **@serwist/next** | **סטייה:** `next-pwa` לא מתוחזק ולא תומך טוב ב-App Router של Next 15. Serwist הוא הממשיך הרשמי שלו |
| בדיקות | **Vitest** (מנוע התכנון, providers) + **Playwright** (זרימות UI, RTL) | כמו במסמך |
| Deploy | **Vercel** + Postgres מנוהל (Neon) | SQLite לא עובד ב-Vercel (הדיסק זמני). ראה שאלות |
| AI chat | **Anthropic API** (Claude) עם structured output → פעולות עריכה מבניות על ה-Itinerary | דורש מפתח. במצב דמו הכפתור מוצג עם הסבר "דורש מפתח" |

---

## 3. מבנה הפרויקט

```
triplan/
├── PLAN.md
├── README.md
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                  <- מדינות + POIs ל-3 יעדי דמו
├── messages/
│   ├── he.json  en.json  ar.json  ru.json  es.json  fr.json
│   ├── de.json  it.json  pt.json  zh-CN.json  ja.json  hi.json
├── data/
│   ├── countries.json           <- snapshot של REST Countries (עובד אופליין ובלי מפתח)
│   └── pois/{country}.json      <- דאטה ידני-למחצה ל-3 יעדי הדמו
├── src/
│   ├── app/[locale]/
│   │   ├── (marketing)/page.tsx           <- דף נחיתה
│   │   ├── plan/[step]/page.tsx           <- ה-Wizard (10 שלבים)
│   │   ├── trip/[id]/page.tsx             <- תצוגת התוכנית (timeline/מפה/לוח שנה/רשימה)
│   │   ├── trip/[id]/now/page.tsx         <- מצב "עכשיו" בשטח
│   │   ├── share/[token]/page.tsx         <- צפייה read-only
│   │   ├── know-before/[country]/page.tsx <- "לדעת לפני הטיול"
│   │   ├── gallery/page.tsx               <- תוכניות מוכנות
│   │   ├── profile/page.tsx
│   │   └── disclosure/page.tsx            <- גילוי נאות (קישורי שותפים)
│   ├── app/api/                           <- route handlers (planner, export, share, ai)
│   ├── components/
│   │   ├── ui/            <- shadcn
│   │   ├── wizard/
│   │   ├── itinerary/     <- DayCard, ActivityCard, Timeline, MapView, CalendarView
│   │   └── layout/
│   ├── lib/
│   │   ├── planner/       <- המנוע. pure functions בלבד. אפס תלות ב-React/DB/רשת
│   │   │   ├── types.ts          (TripPreferences, Itinerary, POI, ...)
│   │   │   ├── budgets.ts        (תקציב זמן/מרחק יומי)
│   │   │   ├── scoring.ts        (ניקוד POI לפי העדפות)
│   │   │   ├── clustering.ts     (אשכולות גיאוגרפיים)
│   │   │   ├── routing.ts        (סדר ביקור בתוך יום, TSP מקורב)
│   │   │   ├── scheduling.ts     (שיבוץ לשעות, שעות פתיחה, הפסקות)
│   │   │   ├── multiBase.ts      (מסלול נודד / טיולי כוכב)
│   │   │   ├── variety.ts        (גיוון בין ימים, יום קל אחרי קשה)
│   │   │   ├── validate.ts       (בדיקת שפיות — חובה לפני החזרה)
│   │   │   ├── explain.ts        (יצירת reason לכל שיבוץ)
│   │   │   └── index.ts          (generateItinerary, replanDay, swapActivity, ...)
│   │   ├── providers/     <- שכבת הפשטה + mocks
│   │   │   ├── types.ts          (interfaces: PoiProvider, RoutingProvider, WeatherProvider, ...)
│   │   │   ├── registry.ts       (בוחר ספק לפי env; נפילה ל-mock + באנר דמו)
│   │   │   ├── countries/  pois/  routing/  weather/  holidays/  currency/
│   │   │   ├── hotels/  tickets/  flights/   (deep links בלבד)
│   │   │   └── affiliate.ts      (buildAffiliateLink — נקודת יציאה יחידה)
│   │   ├── i18n/
│   │   ├── export/        <- pdf, ics, gpx, kml
│   │   ├── offline/       <- שמירת תוכנית + אריחי מפה
│   │   ├── guest/         <- localStorage + מיגרציה לחשבון
│   │   └── db.ts
│   └── styles/
├── tests/
│   ├── unit/planner/      <- תרחישים: משפחה+תינוק, זוג 70+, זוג ספורטיבי פעם 3, קבוצה עם רכב
│   └── e2e/               <- Playwright
└── scripts/
    ├── i18n-check.ts      <- מפתחות חסרים -> נכשל ב-CI
    └── fetch-countries.ts <- מרענן את data/countries.json
```

---

## 4. סכימת נתונים (Prisma)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String?  @unique
  name          String?
  image         String?
  locale        String   @default("he")
  units         String   @default("metric")     // metric | imperial
  currency      String   @default("ILS")
  profile       TravelerProfile?
  trips         Trip[]
  visited       VisitedPlace[]
  memberships   TripMember[]
  createdAt     DateTime @default(now())
}

model TravelerProfile {         // העדפות שנשמרות בין טיולים
  id            String  @id @default(cuid())
  userId        String  @unique
  user          User    @relation(fields: [userId], references: [id])
  defaults      Json    // TripPreferences חלקי: קצב, תחומי עניין, תקציב, נגישות
}

model Trip {
  id            String   @id @default(cuid())
  ownerId       String?                          // null = אורח (נשמר רק ב-localStorage עד הרשמה)
  owner         User?    @relation(fields: [ownerId], references: [id])
  title         String
  status        String   @default("draft")        // draft | planned | active | done
  preferences   Json                              // TripPreferences (Zod-validated)
  startDate     DateTime
  endDate       DateTime
  countries     String   // JSON array של ISO codes (עד 3)
  baseMode      String   // single | multi | auto
  days          Day[]
  accommodations Accommodation[]
  members       TripMember[]
  shareToken    String?  @unique
  shareCanEdit  Boolean  @default(false)
  packingList   Json?
  checklist     Json?
  budget        Json?    // תקציב מוערך מחושב
  journal       Json?    // יומן טיול אחרי הנסיעה
  isTemplate    Boolean  @default(false)         // לגלריה
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Day {
  id            String   @id @default(cuid())
  tripId        String
  trip          Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  index         Int                               // 0-based
  date          DateTime
  clusterId     String?
  baseAccommodationId String?
  stats         Json     // { walkKm, elevationM, activeMinutes, transitMinutes, intensity }
  weather       Json?    // תחזית / נורמלים
  rainPlan      Json?    // חלופה מקורה
  warnings      Json     // [{ code, message, severity }]
  activities    Activity[]
  @@unique([tripId, index])
}

model Activity {
  id            String   @id @default(cuid())
  dayId         String
  day           Day      @relation(fields: [dayId], references: [id], onDelete: Cascade)
  placeId       String?
  place         Place?   @relation(fields: [placeId], references: [id])
  kind          String   // visit | meal | transit | rest | hotel_checkin | hotel_checkout | free
  order         Int
  startMin      Int      // דקות מחצות
  endMin        Int
  locked        Boolean  @default(false)
  reason        String?  // "קרוב למלון, 12 דק' הליכה"
  transitFromPrev Json?  // { mode, minutes, meters }
  bookingUrl    String?
  notes         String?
  votes         Json?    // { userId: "up" | "down" }
}

model Place {                    // POI — מקור: seed / OSM / Google
  id            String   @id @default(cuid())
  externalId    String?  @unique   // "osm:node:123" / "google:ChIJ..."
  countryCode   String
  city          String?
  nameLocal     String            // "Museo del Prado"
  names         Json              // { he: "מוזיאון הפראדו", en: "Prado Museum", ... }
  category      String            // museum | park | viewpoint | landmark | beach | market | ...
  tags          Json              // ["history", "art", "kids-ok"]
  lat           Float
  lng           Float
  elevationM    Float?
  openingHours  String?           // בפורמט OSM opening_hours
  closedDates   Json?             // ["2026-12-25"]
  visitMinutes  Int               // משך ביקור טיפוסי
  iconicity     Float             // 0-1
  minAge        Int?
  wheelchair    String?           // yes | limited | no | unknown
  strollerOk    Boolean?
  priceLevel    Int?              // 0-4
  ticketUrl     String?
  requiresAdvanceBooking Boolean  @default(false)
  dataQuality   String   @default("unverified")  // verified | partial | unverified
  source        String            // seed | osm | google | user
  activities    Activity[]
  visited       VisitedPlace[]
}

model Accommodation {
  id            String   @id @default(cuid())
  tripId        String
  trip          Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  name          String?
  type          String   // hostel | 3star | 4star | 5star | apartment | boutique | camping
  lat           Float?
  lng           Float?
  checkIn       DateTime
  checkOut      DateTime
  locationPref  String?  // center | station | beach | quiet
  bookingUrl    String?
}

model TripMember {               // תכנון משותף
  id      String @id @default(cuid())
  tripId  String
  userId  String
  role    String // owner | editor | viewer
  trip    Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)
  user    User   @relation(fields: [userId], references: [id])
  @@unique([tripId, userId])
}

model VisitedPlace {             // "כבר ביקרתי"
  id       String   @id @default(cuid())
  userId   String
  placeId  String
  when     DateTime?
  user     User     @relation(fields: [userId], references: [id])
  place    Place    @relation(fields: [placeId], references: [id])
  @@unique([userId, placeId])
}

model Country {                  // snapshot מ-REST Countries
  code        String @id        // ISO 3166-1 alpha-2
  names       Json               // { he, en, local, ... }
  flag        String             // emoji
  currency    String
  languages   Json
  drivingSide String
  callingCode String
  timezone    String
  lat         Float
  lng         Float
  region      String
}
```

**טיפוסים מרכזיים ב-`src/lib/planner/types.ts`** (מוגדרים ב-Zod, נגזרים ל-TS):

- `TripPreferences` — כל תשובות ה-Wizard: `destinations[]`, `dates`, `party` (מבוגרים / ילדים+גילאים / תינוקות+עגלה / 65+), `visitNumber` (1/2/3+), `effort` (low/med/high), `accessibility[]`, `transport{mode: weight}`, `carOptions`, `interests` (מדורגים), `budget`, `hotel{type, locationPref, baseMode}`, `flightTimes?`, `alreadySeen[]`.
- `Itinerary` — `days[]` → `blocks[]` → `activities[]`, עם `stats`, `warnings`, `rainPlan` לכל יום, ו-`reason` לכל פעילות.
- `POI` — המקבילה הטהורה של `Place` (בלי Prisma).

---

## 5. ארכיטקטורת מנוע התכנון (`src/lib/planner/`)

טהור לחלוטין: קלט → פלט, בלי רשת, בלי DB, בלי React. כל דאטה חיצוני (POIs, מטריצת זמנים, מזג אוויר, חגים) מגיע **כפרמטר**. זה מה שמאפשר לבדוק אותו ביחידות.

**צינור (pipeline):**

1. **`computeBudgets(prefs)`** → תקציב זמן יומי (8–10 שעות, מופחת עם ילדים / 65+ / מעט הליכה), תקציב מרחק (ק"מ), buffer 20%, חלון ארוחת צהריים, מגבלת נסיעה מהבסיס (3 שעות הלוך-חזור, 2 עם ילדים).
2. **`filterPois(pois, prefs)`** → מסיר: מגבלות גיל/גובה, אי-נגישות (כיסא גלגלים / עגלה), "כבר ראיתי", קטגוריות שהמשתמש דחה.
3. **`scorePois(pois, prefs)`** → ציון 0–1 מ: התאמה לתחומי עניין (משוקלל לפי דירוג), `iconicity` (הפוך לפי מספר ביקור), התאמה לילדים, מחיר מול תקציב, רגישות למזג אוויר.
4. **`clusterPois(pois, travelMatrix)`** → DBSCAN על קואורדינטות + זמן נסיעה בפועל. פלט: אשכולות עם מרכז, רדיוס, וזמן נסיעה מהבסיס.
5. **`assignDays(clusters, days, prefs)`** → כל יום = אשכול אחד או שניים סמוכים. יום ראשון/אחרון = חצי עומס. אשכול רחוק = יום שלם. multi-base: TSP מקורב על אשכולות → מסלול מלונות עם מינימום העברות, העברות בבוקר ולא ביום עם אטרקציה גדולה.
6. **`scheduleDay(day, pois, opening, weather)`** → סדר ביקור (nearest-neighbor + 2-opt), שיבוץ לשעות עם שעות פתיחה, הפסקות כל 2–3 שעות עם ילדים, מקסימום 2 מוזיאונים ליום עם ילדים, ארוחת צהריים, `rainPlan` מאותו אשכול.
7. **`applyVariety(days)`** → מונע שני ימים דומים ברצף, מכניס יום קל אחרי יום מאומץ.
8. **`explain(itinerary)`** → `reason` קצר לכל פעילות.
9. **`validate(itinerary, budgets)`** → **חובה.** נכשל אם: יום חורג מתקציב מרחק/זמן, אתר סגור בתאריכו, קפיצה גיאוגרפית לא סבירה, מוזיאון ביום סגירה. פלט: רשימת `warnings` + `errors`. המנוע לא מחזיר תוכנית עם `errors`.

**פעולות עריכה (גם הן טהורות):** `moveActivity`, `swapActivity` (3 חלופות מאותו אשכול ותקציב זמן), `rebalanceDay(lighter | heavier)`, `rebuildUnlocked` (שומר 📌), `applyAiEdits(itinerary, structuredOps[])`.

---

## 6. שכבת ספקים (`src/lib/providers/`)

לכל קטגוריה `interface` אחד + מימוש אמיתי + מימוש mock. `registry.ts` בוחר לפי env var; אם חסר → mock + באנר "מצב דמו".

| קטגוריה | ספק אמיתי | mock / ללא מפתח | דורש מפתח? |
|---|---|---|---|
| מדינות | REST Countries | snapshot ב-`data/countries.json` | לא |
| POIs | Overpass (OSM) → Google Places (אופציה) | `data/pois/*.json` ל-3 יעדים | Overpass: לא. Google: כן |
| ניתוב | OSRM ציבורי / Valhalla | הערכה לפי מרחק אווירי × מקדם | לא (עם מגבלת קצב) |
| מזג אוויר | Open-Meteo (תחזית 16 יום + נורמלים) | נורמלים עונתיים קבועים | לא |
| חגים | Nager.Date | רשימה קטנה ב-seed | לא |
| מטבע | frankfurter.app (חינמי, בלי מפתח) | שערים קבועים ב-seed | לא |
| גובה | Open-Meteo Elevation | 0 + סימון "לא ידוע" | לא |
| מלונות | Booking / Hotels.com / Agoda / Hostelworld | אותו deep link בלי affiliate id | affiliate id אופציונלי |
| כרטיסים | GetYourGuide / Viator / Tiqets / Klook | deep link לחיפוש | affiliate id אופציונלי |
| טיסות | Kiwi / Skyscanner | deep link | אופציונלי |
| AI | Anthropic | כפתור מושבת + הסבר | כן |

**כל קישור חיצוני** עובר דרך `buildAffiliateLink()` יחיד, נפתח ב-`target="_blank" rel="noopener noreferrer sponsored"`, מסומן בממשק, ומוסבר בעמוד גילוי נאות.

**אל תמציא:** POI בלי קואורדינטות / שעות אמיתיות → `dataQuality: 'unverified'` + הודעה "לא אומת — בדוק לפני היציאה".

---

## 7. i18n

- `messages/{locale}.json`, 12 שפות. עברית ברירת מחדל, זיהוי מ-`Accept-Language`, בורר שפה נשמר ב-cookie.
- `dir="rtl"` ל-he/ar. **רק** logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`). כלל ESLint שאוסר `ml-` / `mr-` / `left-` / `right-`.
- מספרים / תאריכים / מטבע / יחידות דרך `Intl` בלבד. מתג מטרי / אימפריאלי.
- `npm run i18n:check` — משווה כל קובץ ל-`he.json`, נכשל על מפתח חסר.
- שמות מקומות: "מוזיאון הפראדו / Museo del Prado" תמיד יחד.

---

## 8. Milestones — סדר בנייה ותנאי סיום לכל אחד

כל milestone נגמר במצב: `npm run dev` רץ, `npm run build` נקי, `npm run lint` נקי, `npm test` עובר, אין שגיאות בקונסול. branch נפרד לכל אחד. אחרי כל אחד — סיכום קצר + עצירה לאישור.

| # | שם | מה נבנה | תנאי סיום |
|---|---|---|---|
| 1 | **תשתית** | Next 15 + TS strict + Tailwind + shadcn + next-intl (he+en) + RTL + dark mode + layout + ניווט + Serwist בסיסי + git init | דף נחיתה בעברית / אנגלית, מתחלף RTL/LTR, dark mode, deploy ראשון ל-Vercel (אם יש חשבון) |
| 2 | **מודל נתונים** | סכימת Prisma מלאה, `countries.json`, seed ל-3 יעדי דמו (~40–60 POIs לכל יעד עם קואורדינטות אמיתיות ושעות פתיחה מאומתות ידנית ככל האפשר) | `npm run db:seed` עובד, דף `/know-before/[country]` מציג נתוני מדינה |
| 3 | **Wizard** | 10 שלבים, Zod, progress bar, אחורה, שמירת draft ב-localStorage, מצב אורח, בחירת מדינות עם חיפוש בשם מקומי / אנגלי / עברי | אפשר לעבור את כל השאלון בטלפון ולראות סיכום. Playwright test בסיסי |
| 4 | **מנוע התכנון** | כל ה-pipeline בסעיף 5 + `validate` + 4 תרחישי בדיקה + property tests על תקציבים | `npm test` עם 40+ בדיקות יחידה ירוקות. אף תוכנית לא עוברת validate עם errors |
| 5 | **תצוגת התוכנית** | timeline, מפה (MapLibre), לוח שנה, רשימה — מסונכרנים. גרירה בין ימים, החלף פעילות, עמוס / קל מדי, נעילה 📌, בנה מחדש. מצב "עכשיו" | עורכים תוכנית בטלפון ובדסקטופ, ב-RTL, בלי שגיאות |
| 6 | **אינטגרציות** | Overpass, OSRM, Open-Meteo, Nager.Date, מטבע, deep links למלונות / כרטיסים, באנר דמו, התראות חכמות | האפליקציה עובדת בלי מפתחות, ומשתפרת עם מפתחות. Zod על כל תשובה |
| 7 | **ייצוא, שיתוף, PWA, אופליין** | PDF, ICS, GPX/KML, קישור שיתוף read-only / edit, התקנה למסך הבית, תוכנית + אריחים אופליין, תקציב מוערך, רשימת ציוד, צ'ק-ליסט | מתקינים למסך הבית, מכבים Wi-Fi, התוכנית והמפה עובדות |
| 8 | **הרחבה וליטוש** | 12 שפות, בדיקות RTL/LTR ב-Playwright, Auth.js (Google + magic link) + מיגרציית אורח, תכנון משותף, פרופיל, יומן, גלריה, צ'אט AI, Lighthouse 90+ | כל תנאי ה-Definition of Done במסמך המקור |

**הערה על סדר:** הרשמה (Auth) הוזזה ל-milestone 8 כי מצב אורח מכסה את כל הפיצ'רים עד אז, וכי היא דורשת מפתחות חיצוניים.

---

## 9. Assumptions — החלטות שקיבלתי בלי לשאול

1. **מיקום הפרויקט:** התיקייה `Claude Code` לא ריקה (יש בה פרויקט ההגדה), לכן הפרויקט נבנה ב-`Claude Code/triplan/`. שם יהיה ה-git repo.
2. **שפת הקוד:** קוד, הערות, commits ו-README באנגלית (סטנדרט, נוח ל-Vercel ולכלים). הממשק בעברית ברירת מחדל. `PLAN.md` וסיכומי milestones בעברית.
3. **Locale ברירת מחדל:** `he`. URL בלי locale מפנה ל-`/he`.
4. **מטבע ברירת מחדל:** ILS. יחידות: מטרי.
5. **`next-pwa` → `@serwist/next`** (ראה טבלה בסעיף 2).
6. **בלי Prisma enums** (String + Zod), כדי ש-SQLite ו-Postgres יתנהגו זהה.
7. **Auth.js v5** במקום NextAuth v4 — זו הגרסה הנוכחית של אותה ספרייה.
8. **Tailwind v4** — הגרסה שמגיעה עם `create-next-app` היום. logical properties נתמכים.
9. **ניתוב במצב דמו:** בלי OSRM, זמן נסיעה = מרחק אווירי × 1.3 חלקי מהירות לפי אמצעי (הליכה 4.5 קמ"ש, אופניים 14, רכב עירוני 30, בין-עירוני 70, תח"צ 20). מסומן `estimated: true`.
10. **אשכולות:** DBSCAN (לא k-means) כי לא צריך לדעת מראש כמה אשכולות, ומתמודד טוב עם POIs מבודדים.
11. **שעות פתיחה:** נשמרות בפורמט OSM `opening_hours` ומפוענחות בספריית `opening_hours` (JS). POI בלי שעות → `unverified`, מותר לשבץ אבל עם אזהרה.
12. **"לדעת לפני הטיול":** מוצגים **רק** שדות שיש להם מקור (מטבע, שפות, צד נהיגה, חיוג, שקע / מתח, אזור זמן). ויזה / חיסונים / בטיחות / כשרות → קישורים לאתרים רשמיים (משרד החוץ, WHO) ולא טקסט שאני מנסח. **סיבה:** כלל "אל תמציא נתונים".
13. **תרגומים ל-12 שפות:** ייכתבו על ידי, באיכות "מכונה טובה". עברית ואנגלית ייבדקו בקפידה; השאר יסומנו ב-README כ"דורשים בדיקת דובר שפה".
14. **תכנון משותף:** ללא real-time (בלי WebSockets) בגרסה ראשונה — רענון / polling. הצבעות והערות נשמרות ב-DB.
15. **צ'אט AI:** מודל `claude-sonnet-5` (יחס מחיר / איכות), structured output לרשימת פעולות (`add_day_theme`, `remove_category`, `swap`, ...) שעוברות דרך אותן פונקציות עריכה טהורות. אף פעם לא כותב ישירות על ה-Itinerary.
16. **תמונות יעדים:** Wikimedia Commons עם ייחוס, או placeholder מעוצב בקוד — לא תמונות של POIs ספציפיים שלא אומתו.
17. **גופן:** Rubik (תמיכה עברית + לטינית + קירילית מלאה; Heebo חסר קירילית).
18. **Package manager:** npm (מותקן; pnpm לא).
19. **גרסת Next:** 15.5 (האחרונה בסדרת 15), כפי שביקש המסמך. Next 16 קיים אבל לא נדרש; שדרוג אפשרי בהמשך.
20. **אנימציות כניסה:** ב-CSS (tw-animate-css) ולא ב-Framer Motion, כדי שהתוכן ייראה גם לפני שה-JavaScript נטען. Framer Motion שמור למעברים בין שלבי ה-Wizard.
21. **רכיבי shadcn (`src/components/ui/`)** פטורים מכלל ה-ESLint של RTL: הם קוד ספרייה, ו-Sheet מחשב צד פיזי מכיוון הטקסט בזמן ריצה.
22. **REST Countries הוחלף:** ה-API הישן נסגר ודורש היום מפתח בתשלום. במקומו: הדאטהסט הפתוח שעליו הוא נבנה (`mledoze/countries`, רישיון ODbL) + Wikidata (שמות בעברית, צד נהיגה, אזורי זמן). התוצאה שמורה ב-`data/countries.json` (250 מדינות, 249 עם שם עברי) ולא דורשת רשת בזמן ריצה.
23. **Prisma 6** (לא 7): גרסה 7 שינתה את מבנה הקונפיגורציה ודורשת driver adapters; 6 פשוטה ומתועדת היטב. ב-SQLite אין טיפוס Json, לכן שדות מובנים נשמרים כ-String עם JSON ומאומתים ב-Zod (מסומנים `/// JSON:<Type>` בסכימה).
24. **דאטה של POIs נבנה בשני שלבים:** רשימה ערוכה ידנית (`scripts/pois/*.ts`: שמות בשלוש שפות, קטגוריה, תגיות, iconicity, זמן ביקור, מחיר) + אימות מול OpenStreetMap דרך Nominatim (`scripts/build-pois.ts`: קואורדינטות מדויקות, שעות פתיחה, נגישות, אתר, Wikidata). `dataQuality`: verified = נמצא ב-OSM עם שעות; partial = נמצא בלי שעות; unverified = לא נמצא (קואורדינטות משוערות).
26. **טיוטת השאלון** נשמרת ב-localStorage דרך zustand/persist (מפתח `triplan:wizard-draft`), וטיולי אורח ב-`triplan:guest-trips`. אין DB בצד הלקוח עד ההרשמה (milestone 8).
27. **מדינות שאינן יעדי דמו** מוצגות בשאלון עם תווית "בבנייה" ואי אפשר לבחור אותן, לפי ההחלטה בשאלה 2. ההגבלה יורדת ב-milestone 6.
28. **בדיקות Playwright** רצות מול `next dev` עם worker אחד: שרת הפיתוח מקמפל דפים בעצלות, ושני דפדפנים במקביל גרמו ל-timeouts מזויפים.
29. **המנוע דטרמיניסטי וללא רשת:** מזג אוויר וחגים נכנסים כפרמטרים אופציונליים (`weather`, `holidays`). זמני נסיעה משוערים בקו אווירי × 1.3 עם מהירויות לפי אמצעי (`estimated: true`); OSRM יחליף אותם ב-milestone 6 באותו interface.
30. **שעות פתיחה חסרות = "כנראה פתוח" עם דגל**, לא "סגור": אחרת רוב העולם היה ריק. אתר שסגור בתאריך נופל מהתוכנית ומופיע באזהרה.
31. **יעד קטן וטיול ארוך:** המנוע מפזר את האטרקציות על פני הימים (קיבולת יומית מוקטנת) במקום למלא את הימים הראשונים ולהשאיר את השאר ריקים; אם בכל זאת נגמרו, אזהרת `few_places_left`.
32. **הסברים ואזהרות הם קודים מובנים** (`reasons[].code` + params), והממשק מתרגם. זה מה שמאפשר 12 שפות בלי לגעת במנוע.
33. **עוצמת יום** נמדדת בעיקר לפי ק"מ הליכה ביחס לתקציב (לא לפי מספר אטרקציות); יום עם הרבה זמן במקומות אבל מעט הליכה הוא "בינוני".
34. **עריכה דרך API ולא בדפדפן:** פעולות העריכה רצות בשרת (`/api/plan/edit`) עם כל מאגר האטרקציות; הלקוח שולח את התוכנית הנוכחית ומקבל חדשה. שומר את החבילה של הדפדפן קטנה (ספריית שעות הפתיחה כבדה) ונותן ל"קל מדי"/"בנה מחדש" גישה לכל המאגר. עריכה אופליין לא נתמכת; צפייה אופליין כן (milestone 7).
35. **מפה:** אריחי וקטור של OpenFreeMap (חינם, בלי מפתח, סגנון liberty/fiord לבהיר/כהה). המסלול היומי מצויר בקווים ישרים עד שיהיה ניתוב אמיתי.
36. **ה-worker של MapLibre** (שמפענח אריחי מפה) מוגש כקובץ סטטי מ-`public/maplibre/` (מועתק ב-`postinstall`), כי Turbopack לא מצא אותו כמודול. בלי זה המפה מציגה רק רקע.
37. **בדיקת המפה** נעשית ב-Playwright: צילום הקנבס ובדיקה שיש בו מגוון צבעים (אריחים אמיתיים), כי חלונית הדפדפן של Claude מוסתרת ולא מריצה את לולאת הרינדור של WebGL.
25. **"לדעת לפני הטיול"** עובד לכל 250 המדינות (עובדות בסיסיות) ומציג מידע מעשי מורחב (חשמל, חירום, טיפים, מי ברז) רק ל-3 יעדי הדמו, מקובץ `data/country-extras.json` שכל רשומה בו מציינת מקור.

---

## 10. דברים במסמך שאינם ריאליים / דורשים תיאום ציפיות

הוראה 11 במסמך ביקשה לומר ולא להמציא פתרון שקט. אז:

1. **"עובד במלואו בלי אף מפתח API" מול "כל מדינות העולם":** בלי מפתח, ה-POIs מגיעים מ-Overpass (OSM). זה חינמי אבל **איטי (5–30 שניות לשאילתה), מוגבל בקצב, ולפעמים נופל**. הדאטה של OSM גם לא אחיד: בפריז יש שעות פתיחה לרוב האתרים, בכפר בגאורגיה כמעט לא. לכן: **3 יעדי הדמו יעבדו מצוין תמיד; שאר העולם יעבוד "כמיטב היכולת" עם הרבה `unverified`.** זה לא באג, זו מציאות הדאטה. ראה שאלה 2.
2. **`iconicity` ו-`visitMinutes`:** אין מקור חינמי לזה. ל-3 יעדי הדמו אכתוב ידנית. לשאר — היוריסטיקה (קיום ערך Wikipedia / Wikidata, קטגוריה) ומסומן כמוערך.
3. **"אסור לשבץ מוזיאון ביום סגירה":** ניתן לאכוף רק כשיש שעות פתיחה. כשאין — אזהרה "לא אומת", לא חסימה. אחרת רוב העולם יהיה ריק.
4. **Lighthouse 90+ בכל הקטגוריות** עם MapLibre + Framer Motion + 12 שפות: אפשרי, אבל דורש lazy loading אגרסיבי של המפה ואנימציות. יימדד רק ב-milestone 8.
5. **קישורי שותפים:** בלי affiliate IDs (שדורשים הרשמה ואישור אצל כל רשת) הקישורים יהיו deep links רגילים. הקוד יהיה מוכן; ה-IDs באחריותך.
6. **היקף:** זה פרויקט של חודשים לצוות. אני אבנה אותו milestone אחר milestone, אבל תצפה ש-milestones 5–8 ייקחו כל אחד כמה סשנים ארוכים. "העדף פתרון שרץ" — אני אפעיל את זה בכל צומת.

---

## 11. יומן milestones

| # | סטטוס | תאריך | branch | הערות |
|---|---|---|---|---|
| 1 | ✅ הושלם | 2026-09-03 | `milestone-1-foundation` | Deploy ל-Vercel נדחה (אין חשבון עדיין). נבדק ידנית בדפדפן: he/en, RTL/LTR, dark mode, מובייל, 404, manifest |
| 2 | ✅ הושלם | 2026-09-03 | `milestone-2-data-model` | סכימת Prisma (10 מודלים, SQLite), 250 מדינות עם שמות בעברית, 207 אטרקציות ב-7 אזורים (ליסבון, סינטרה/קשקאיש, פורטו, רומא, טיבולי, טוקיו, קמאקורה/האקונה) מאומתות מול OSM, דף "לדעת לפני הטיול" לכל מדינה + חיפוש, 27 בדיקות |
| 3 | ✅ הושלם | 2026-09-04 | `milestone-3-wizard` | 10 שלבים, ולידציה ב-Zod, שמירת טיוטה אוטומטית (localStorage), מצב אורח עם "הטיולים שלי", דירוג תחומי עניין בגרירה, המלצת בסיס אחד/נודד. 41 בדיקות יחידה + 4 בדיקות Playwright (טלפון + דסקטופ) |
| 4 | ✅ הושלם | 2026-09-04 | `milestone-4-planner` | מנוע טהור ב-`src/lib/planner/` (13 מודולים): תקציבים, סינון וניקוד, DBSCAN, בסיס אחד/נודד, שיבוץ ימים, מזג אוויר, גיוון, לוח זמנים עם שעות פתיחה, הסברים, ולידציה + תיקון אוטומטי, פעולות עריכה. 115 בדיקות כולל 4 תרחישים ו-40 מטיילים אקראיים. `POST /api/plan` + תצוגת תוכנית ראשונית בדף הטיול |
| 5 | ✅ הושלם | 2026-09-04 | `milestone-5-plan-views` | 4 תצוגות מסונכרנות (ציר זמן, מפה MapLibre + OpenFreeMap, לוח שנה, רשימה), גרירה בתוך יום ובין ימים, החלפת פעילות עם 3 חלופות, נעילה, "עמוס/קל מדי", "בנה מחדש", ביטול, מצב "עכשיו" עם ניווט. `POST /api/plan/edit` עם פעולות מובנות (אותו פורמט ישמש את הצ'אט ב-8) |
| 6 | ⏳ הבא | | | |

---

## 12. שאלות פתוחות (עד 5)

התשובות ייכתבו כאן אחרי קבלתן.

| # | שאלה | תשובה (2026-09-03) |
|---|---|---|
| 1 | Vercel / GitHub / Postgres — יש חשבונות? | אין עדיין. בונים מקומית; ה-deploy נדחה עד פתיחת חשבונות (אדריך צעד-צעד) |
| 2 | מדיניות דאטה מחוץ ל-3 יעדי הדמו | עד milestone 6: רק יעדי הדמו, שאר המדינות מסומנות "בבנייה". מ-6: Overpass בזמן אמת + סימון unverified |
| 3 | אילו 3 יעדי דמו | פורטוגל (ליסבון + פורטו), איטליה (רומא), יפן (טוקיו) |
| 4 | מפתח Anthropic לצ'אט | אין. הצ'אט נבנה ב-milestone 8; עד אז כפתור "דורש מפתח" |
| 5 | he+en בלבד עד milestone 8? | כן. 10 השפות הנוספות ב-milestone 8, מסומנות כדורשות בדיקת דובר |
