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
| 8a | **שפות וליטוש** | 12 שפות (מתורגמות על ידי Claude, דורשות ביקורת דובר שפת אם), ערבית RTL, גופנים ל-CJK/דוונגרי, מתג ק"מ/מייל, בדיקות Playwright לכל שפה, מדידת Lighthouse ראשונה | כל 12 השפות עוברות `i18n:check` ו-e2e, RTL בערבית מאומת |
| 8b | **חשבונות** | Auth.js v5 (magic link, Google כשיש מפתחות) + מיגרציית אורח לחשבון + סנכרון בין מכשירים, פרופיל מטייל שממלא את השאלון, ארכיון "כבר ביקרתי", יומן טיול, גלריית תוכניות מוכנות | כניסה בלי אף מפתח (קישור דמו על המסך), טיול אורח עובר לחשבון אוטומטית, e2e לכל הזרימה |
| 8c | **שיתוף פעולה וליטוש** | תכנון משותף (הזמנות, הצבעות, הערות), צ'אט AI לעריכת התוכנית (דורש מפתח Anthropic), Lighthouse 90+ בביצועים | כל תנאי ה-Definition of Done במסמך המקור |
| 9 | **הכנסות וניווט** (בקשת טל, 2026-09-05) | קישורי מלונות/טיסות/רכב שנפתחים על העיר והתאריכים, תשתית לכל תוכניות השותפים + מדריך הרשמה, הסבר על כל אתר ליד הקישורים ובדף הגילוי, ניווט יומי ב-Google Maps, מסלולים על רחובות אמיתיים במפה | e2e שבודק את הקישורים העמוקים, רכב, ההסברים, קישור הניווט והמסלול האמיתי |
| 13 | **פריסה** (2026-09-06) | Vercel + Neon (PostgreSQL), `vercel.json` עם בנייה שמריצה `prisma db push` + seed + build, מדריך צעד-צעד `docs/deploy.md` | האתר עולה מכתובת ציבורית, תכנון אורח וקישורי שיתוף עובדים שם |
| 12 | **5 תחומי עניין, אטרקציות, עונתיות, 65+ ומסעדה ברשימה** (בקשת טל, 2026-09-05) | דירוג 5 תחומי עניין, תחום "אטרקציות", "מה קורה בתקופה שלכם" (קובץ מאוצר עם מקורות), הנחות לגיל 65+ (קובץ מאוצר), זיהוי סוג המקום מ-OSM לרשימת החובה ושיבוץ מסעדה בזמן ארוחה, בלי להפיל מקום מהרשימה בעריכות | בדיקות יחידה לחלונות תאריכים, לסיווג, למסעדה בצהריים ול"קל מדי"; e2e עם מסעדה חופשית, בן 65+ ותאריכי יוני |
| 11 | **רשימת חובה, מסעדות וערבים** (בקשת טל, 2026-09-05) | שלב "חובה לבקר" בתחילת השאלון (השלמה מהמאגר או טקסט חופשי שמאותר בבנייה), מסעדות ליד כל ארוחה מ-OpenStreetMap, בלוק ערב לכל יום לפי סגנון (רגוע/תרבות/חיי לילה/בלי) עם אירועים אמיתיים כשיש מפתח Ticketmaster וקישורי חיפוש לתאריך | e2e שמוסיף לרשימה, בונה תוכנית ובודק שהמקומות נכנסו, שיש מסעדות ליד הארוחה ושיש בלוק ערב |
| 10 | **תיאור לכל אתר** (בקשת טל, 2026-09-05) | שורת הסבר (משפט-שניים) ליד כל אטרקציה בתוכנית, מוויקיפדיה/ויקידאטה בשפת הממשק, בלי טקסט מומצא; מילוי אוטומטי גם לתוכניות ישנות | e2e שבודק שכרטיסי אטרקציה מציגים תיאור עם קישור למקור, גם בתוכנית מהגלריה |

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
38. **REST Countries → הוחלף (ראה 22); Valhalla נבדק ונדחה לטובת OSRM** של FOSSGIS (`routing.openstreetmap.de`), שיש לו פרופילי הליכה/אופניים/רכב ו-table API. תחבורה ציבורית נשארת משוערת (אין שרת חינמי לזה). הניתוב האמיתי מוחל אחרי בניית התוכנית ("refine"): הסדר נשמר, רק הזמנים והמרחקים מתעדכנים, וכל leg מסומן `estimated: false`.
39. **מזג אוויר לתאריך רחוק** (מעבר ל-16 יום) = אותם תאריכים בשנה שעברה מארכיון Open-Meteo, מסומן "שנה שעברה" ולא "תחזית". ההסתברות לגשם מוגבלת ל-60% כדי שלא תיראה כתחזית.
40. **מדינות ללא seed:** המשתמש חייב לבחור עיר (Nominatim); האטרקציות נמשכות מ-Overpass לפי תיבת גבול מוגבלת (~25 ק"מ), מסווגות לקטגוריות שלנו לפי תגי OSM, `iconicity` לפי מספר מהדורות הוויקיפדיה של הפריט ב-Wikidata (sitelinks: 0 → 0.3, ~40 → 0.86, 150+ → 1), ומאותה קריאה ל-Wikidata מגיעים גם שמות בעברית ובעוד 8 שפות. לוחות זיכרון (`historic=memorial`) מסוננים. `dataQuality` verified רק כשיש שעות פתיחה. גרסת האלגוריתם נשמרת ב-`Place.sourceVersion` כדי שה-cache יתחדש כשהוא משתנה. נשמרות ב-DB (Place, source=osm) ל-30 יום. הממשק מסמן "מקור: OpenStreetMap, לא נבדק ידנית".
41. **קישורי שותפים:** בלי IDs הקישורים הם חיפוש רגיל ומסומנים כלא-שותפים; עם ID ב-env מתווספת התווית "קישור שותפים" ו-`rel="sponsored"`. חנויות: Booking, Hotels.com, Agoda, Hostelworld (להוסטל/קמפינג), GetYourGuide, Tiqets, Viator, Klook, Kiwi, Skyscanner.
42. **ייצוא בצד הלקוח:** ICS/GPX/KML נבנים בדפדפן מתוך התוכנית השמורה (בלי שרת). PDF = דף הדפסה ייעודי עם `@media print` ו"שמור כ-PDF" של הדפדפן, במקום ספריית PDF כבדה.
43. **שיתוף:** צילום מצב של התוכנית נשמר כשורת Trip בלי בעלים עם token אקראי. עריכה דרך הקישור (אם הופעלה) שומרת גרסה חדשה לאותו token; בעל הטיול מעדכן דרך כפתור "עדכן את הקישור". עד ההרשמה (milestone 8) ה-token הוא ההרשאה.
44. **אופליין:** Serwist עם runtime caching (דפים network-first עם fallback, אריחי OpenFreeMap cache-first עד 6000 אריחים). "הורד למצב אופליין" ממלא את אותו cache באריחי zoom 12–14 סביב תחנות כל יום. עובד רק ב-build ייצור (ב-dev אין service worker), ולכן נבדק בסקריפט Playwright מול `next start`.
44b. **אימות אופליין** (`npm run verify:offline` מול build ייצור): דף הטיול, התוכנית והמפה נטענים בלי רשת אחרי "הורד למצב אופליין" (39 אריחים לטיול של 4 ימים בליסבון); דף שלא בוקר מציג את דף האופליין. גופני המפה (glyphs) נשמרים רק לטווחים שכבר הוצגו אונליין, לכן ייתכן שתוויות מסוימות יחסרו אופליין.
45. **תקציב:** היוריסטיקה גלויה (מחיר לילה לפי סוג לינה, אוכל לפי רמה, כרטיסים לפי priceLevel, מדד יוקר לפי מדינה) בשקלים דרך שער האמת. מסומן "אומדן גס" ולא כולל טיסות.
46. **12 שפות:** he, en, ar, ru, es, fr, de, it, pt, zh-CN, ja, hi. עשר השפות החדשות תורגמו על ידי Claude מתוך `en.json` (651 מחרוזות כל אחת) עם כללי ריבוי של ICU לכל שפה (רוסית: one/few/many, ערבית: one/two/other, סינית/יפנית: other בלבד). **זה תרגום מכונה איכותי אך לא מבוקר** — לפני השקה לקהל דובר שפה, דובר שפת אם צריך לעבור על הקובץ. שמות מדינות מגיעים מ-Wikidata רק בעברית ובאנגלית; בשאר השפות מוצג השם האנגלי + השם המקומי. הערות טיפים ב"לדעת לפני הטיול" קיימות בעברית ובאנגלית בלבד, ושאר השפות נופלות לאנגלית.
47. **גופנים:** Rubik מכסה עברית, לטינית, ערבית וקירילית (נטען כ-4 subsets). לסינית, יפנית והינדי אין גופן מוטמע — הדפדפן נופל לגופני המערכת (Noto Sans CJK / PingFang / Yu Gothic / Nirmala UI) שמוגדרים ב-`globals.css`. זה חוסך ~10MB של גופנים ומספיק לתצוגה תקינה בכל מערכת הפעלה מודרנית.
48. **יחידות מרחק:** מתג ק"מ/מייל בתפריט השפה, נשמר ב-localStorage (`triplan:units`), בלתי תלוי בשפה (ישראלי שקורא אנגלית עדיין רוצה ק"מ). ברירת המחדל מטרי בכל השפות. המנוע והייצוא (GPX/KML) נשארים במטרים; ההמרה היא רק בתצוגה.
49. **כניסה בלי מפתחות:** Auth.js דורש שירות מייל לקישור כניסה. בלי `AUTH_RESEND_KEY` הקישור נשמר בזיכרון השרת ומוצג על המסך בדף הכניסה ("מצב דמו"). זה מאפשר לכל אחד להיכנס כל כתובת, ולכן פעיל רק מחוץ ל-production או עם `AUTH_DEMO_LOGIN=true` במפורש. בפריסה אמיתית מגדירים Resend (חינמי עד 3,000 מיילים בחודש) ואופציונלית Google OAuth. `AUTH_SECRET` חובה ב-production; בפיתוח יש ערך קבוע.
50. **מודל הסנכרון:** localStorage נשאר מקור האמת של ה-UI (כל התצוגות קוראות ממנו, ולכן הכול עובד אופליין ולאורחים). כשמחוברים, `TripSync` בשכבת ה-layout מעלה כל שינוי (debounce 1.5 שניות) ל-`PUT /api/trips/:id`, ובכניסה מבצע `POST /api/trips` לכל טיולי האורח ואז `GET` וממזג לפי `updatedAt` (הגרסה החדשה מנצחת). הטיול נשמר בשורת Trip באותו מבנה JSON כמו בדפדפן, כך שהמיגרציה היא העלאה פשוטה. אין real-time; עריכה בו-זמנית משני מכשירים מסתיימת ב"האחרון מנצח". מודל TripMember/הצבעות ממתין ל-8c.
51. **פרופיל:** `TravelerProfile.defaults` הוא תת-קבוצה של TripPreferences (מטיילים, קצב, נגישות, תחבורה, תחומי עניין, תקציב, לינה). דף הפרופיל משתמש באותם קומפוננטות של שלבי השאלון, כך שהוא נראה בדיוק כמו השאלון שהוא ממלא. שאלון חדש (טיוטה ריקה) מתחיל מהפרופיל + רשימת "כבר ביקרתי". אורחים מקבלים את אותו פרופיל ב-localStorage (`triplan:profile`) בלי חשבון.
52. **"כבר ביקרתי":** מוציא את האטרקציה מהתוכנית הנוכחית (פעולת `remove` הרגילה), מוסיף אותה ל-`preferences.alreadySeen` של הטיול (בנייה מחדש מדלגת עליה) ולארכיון בפרופיל (טיולים הבאים מדלגים). אטרקציות מ-OSM שלא בטבלת Place נוצרות בה מהצילום שבתוכנית, כדי ש-VisitedPlace יוכל להצביע עליהן.
53. **גלריה:** 4 תוכניות שנבנו עם המנוע האמיתי (OSRM, מזג אוויר) לתאריך קבוע באביב ונשמרו כ-JSON ב-`data/templates/` (~60KB כל אחת, נטענות רק בלחיצה "העתק"). ההעתקה מזיזה את התאריכים לאותו יום בשבוע לפחות 4 שבועות קדימה (כדי ששעות הפתיחה יישארו תקפות) ומוחקת מזג אוויר וחגים ישנים; הודעה בגלריה מציעה "בנה מחדש". תוכניות שמשתמשים מפרסמים לגלריה (Trip.isTemplate) נשארות ל-8c.
54. **יומן:** טקסט ודירוג 1–5 לכל יום + סיכום, בתוך מסמך הטיול (`journal`). אין תמונות (דורש אחסון קבצים בתשלום). היומן פרטי ולא נכלל בצילום שיוצא בקישור שיתוף.
55. **תכנון משותף (8c):** בלי real-time. חבר מצטרף דרך קישור הזמנה (`Trip.inviteToken`, תפקיד קבוע לקישור: עורך או צופה; הבעלים יכול להחליף או לבטל). הטיול המשותף נמשך ל-localStorage של החבר עם `membership` (תפקיד + שם הבעלים), ודף הטיול מושך גרסה חדשה וגם הצבעות/הערות כל 30 שניות. עריכה בו-זמנית: השרת דוחה שמירה ישנה יותר ("stale") והלקוח מושך את החדשה, כלומר "האחרון מנצח" בלי מיזוג. הצבעות (`Vote`) והערות (`Comment`) הן טבלאות משלהן ומצביעות על `activityId` שבתוך ה-JSON של התוכנית; אחרי "בנה מחדש" מזהי פעילות עשויים להתחלף וההצבעות עליהן נעלמות. היומן נשמר רק אצל הבעלים.
56. **צ'אט AI (8c):** המודל לא נוגע בתוכנית. הוא מקבל תיאור דחוס (`compactPlan`: ימים, פעילויות עם מזהים ושעות, עד 25 אטרקציות שלא שובצו, ~60 בייט לפעילות) ומחזיר דרך tool-use רשימת `EditOp` + תשובה. השרת מסנן פעולות שמצביעות על מזהים לא קיימים, והלקוח מריץ אותן אחת-אחת דרך `/api/plan/edit` (אותו קוד כמו הכפתורים, כולל ניתוב אמיתי ובדיקות). מודל ברירת מחדל `claude-sonnet-5`, ניתן לשינוי ב-`ANTHROPIC_MODEL`. בלי `ANTHROPIC_API_KEY` ה-API מחזיר 503 והטאב מסביר. **לא נבדק מול ה-API האמיתי** (אין מפתח); נבדקו הדחיסה (בדיקות יחידה) ומצב "בלי מפתח" (e2e).
57. **ביצועים (8c), מה שנמצא ותוקן:** (א) `import { Slot } from "radix-ui"` משך את כל חבילת radix (160KB) לכל דף, כי החבילה המאוחדת מייצאת namespaces ו-webpack לא מנער אותם; עברנו ל-`@radix-ui/react-*` פרטניים. (ב) Framer Motion (40KB) שימש רק למעבר בין שלבי השאלון והוחלף ב-keyframe CSS. (ג) כל קטלוג ההודעות (50KB) נשלח לכל דף; עכשיו ה-layout שולח רק את מרחבי השמות של השלד ו-`<PageMessages>` מוסיף לכל דף את שלו. (ד) דגלים מ-flagcdn.com (בקשה חיצונית לכל דגל, CLS) הוחלפו בקבצים מקומיים בתיבה בגודל קבוע. (ה) `Link` של Next ביצע prefetch ל-4 דפי ניווט מיד בטעינה; בוטל לניווט. (ו) **באג גלישה אופקית בטלפון** (קיים מאז milestone 3, נתפס עכשיו במדידת CLS): grid בלי `grid-cols-1` במובייל מקבל עמודה אחת ברוחב max-content, וכרטיסי מדינות עם טקסט `truncate` הרחיבו אותה ל-480px; הדף נגלל הצידה ב-RTL. תוקן בכל ה-grids (`grid grid-cols-1 ... sm:grid-cols-2`), ונוספה בדיקת e2e שנכשלת על כל גלישה אופקית בכל 12 השפות. (`content-visibility:auto` שנוסה על השורות הוסר גם הוא.) (ז) אינדקס 250 המדינות מרונדר כמחרוזת HTML בשרת עם 24 שורות גלויות ו"הצג הכל"; החיפוש מסנן DOM בלי hydration.
58. **מה שנשאר בביצועים:** ~1 שנייה של הרצת JS בכל דף היא ה-hydration של React + Next עצמם במכשיר מדומה איטי פי 4; זו עלות המסגרת ולא של הקוד שלנו. במחשב הזה המדידה רועשת (±5 נקודות בין ריצות) והשרת המקומי הוא HTTP/1.1. בפריסה אמיתית (Vercel/CDN, HTTP/2, דחיסת brotli) הציונים בדרך כלל גבוהים ב-5–10 נקודות. הדרך היחידה לעבור 90 בשאלון באופן יציב היא לצמצם עוד את ה-JS שמתבצע בטעינה (למשל לטעון את רשימת 250 המדינות מ-JSON סטטי במקום כ-props), וזה עבודה למילסטון תחזוקה.
25. **"לדעת לפני הטיול"** עובד לכל 250 המדינות (עובדות בסיסיות) ומציג מידע מעשי מורחב (חשמל, חירום, טיפים, מי ברז) רק ל-3 יעדי הדמו, מקובץ `data/country-extras.json` שכל רשומה בו מציינת מקור.
59. **קישורי הזמנה (9):** כל קישור הוא deep link לחיפוש באתר השותף עם העיר (בשם האנגלי, כי החיפוש של האתרים לא מבין עברית), התאריכים, מספר המבוגרים וגילאי הילדים. נבדק בפועל מול האתרים (2026-09-05): Booking מקבל `ss=Rome, Italy`; Agoda **לא** מקבל חיפוש טקסטואלי (מפנה לדף הבית) ולכן הקישור הוא דף העיר `agoda.com/city/rome-it.html` עם התאריכים; Skyscanner מקבל **רק קודי שדות תעופה** (`/flights/tlv/fco/261017/261024/`), לכן נוסף מאגר OurAirports (`data/airports.json`, 3,244 שדות עם טיסות סדירות, `npm run data:airports`): היעד מקבל את השדה הגדול הקרוב (עד 150 ק"מ) ועיר המוצא מזוהה לפי שם; בלי שני הקודים Skyscanner לא מוצג ו-Kiwi (שמבין שמות) נשאר. טיסות: מעיר המוצא שהמטייל הזין בשלב התאריכים, ובלי הזנה מתל אביב לממשק העברי ("anywhere" בשאר השפות). השכרת רכב (Rentalcars, Discover Cars) מופיעה רק כשבחרו רכב בתחבורה, איסוף בעיר הראשונה והחזרה באחרונה. מבנה הכתובות של Rentalcars ו-Discover Cars נבנה לפי הכתובות הציבוריות ולא אומת מול חשבון שותף. **רענון אוטומטי:** לקישורים יש מספר גרסה (`LINKS_VERSION`); טיול שנשמר עם גרסה ישנה מקבל קישורים חדשים בפתיחה הבאה דרך `POST /api/plan/links` (בלי לתכנן מחדש), כך שתיקוני פורמט מגיעים גם לטיולים קיימים ולגלריה.
60. **תוכניות שותפים (9):** אי אפשר להירשם בשם טל; הקוד מוכן לכל 12 האתרים. לשישה יש משתנה ייעודי, ולכולם יש `AFFILIATE_QUERY_<אתר>` שמקבל את מחרוזת המעקב כפי שמחולל הקישורים של האתר מפיק. `docs/affiliates.md` (עברית) מפרט היכן נרשמים ומה מדביקים. דף `/disclosure` מציג לכל אתר אם הקישור שלו פעיל כשותף או רגיל, לפי משתני הסביבה בפועל.
61. **הסבר על האתרים (9):** משפט אחד לכל אתר ב-12 השפות (`plan.links.about.*`), מוצג בתפריט מתקפל "מה האתרים האלה?" מתחת לקישורים, ב-title של כל קישור, ובדף הגילוי בקבוצות (לינה, טיסות, רכב, כרטיסים).
62. **ניווט (9):** (א) לכל יום כפתור "נווטו את היום ב-Google Maps": כתובת Directions עם המלון כמוצא וכל התחנות לפי הסדר כ-waypoints (Google מגביל ל-9 תחנות ביניים; מעבר לזה מוצגות הראשונות והמשתמש מקבל הודעה), מצב נסיעה לפי רוב הקטעים ביום. (ב) המפה שלנו: אחרי ציור הקווים הישרים (מיידי, עובד אופליין) נשלחת בקשה ל-`POST /api/route` שמחזירה גיאומטריה של OSRM (רגל/אופניים/רכב) והקו הופך לרציף על הרחובות, עם מקרא "מסלול היום על רחובות אמיתיים". תחבורה ציבורית אין ב-OSRM, אז ימים כאלה מקבלים גיאומטריית הליכה. אם שרת ה-OSRM הציבורי לא עונה נשארים הקווים הישרים.
63. **תיאור לכל אתר (10):** הטקסט לעולם לא נכתב על ידי מודל. לכל מקום עם מזהה Wikidata נלקח פתיח הערך בוויקיפדיה בשפת הממשק (REST `page/summary`, CC BY-SA, עם קישור "(ויקיפדיה)" לערך), ואם אין ערך בשפה הזו — התיאור הקצר מוויקידאטה; אם אין גם זה מוצגת הקטגוריה בלבד (`plan.categories.*`). הפתיח נחתך ל-1–2 משפטים (עד 280 תווים, בלי סוגריים של הגייה). נשמר ב-`summary` (מפה שפה→{טקסט, קישור}) על המקום: בקובצי ה-seed לעברית ואנגלית (`npm run data:summaries`), בעמודת `Place.summary` ב-DB, ובצילום המקומות שבתוך התוכנית השמורה. מילוי על פי דרישה: ה-planner מבקש את שפת הממשק + אנגלית בבנייה/עריכה, ודף הטיול שולח `POST /api/places/summaries` למקומות שעדיין חסרים (תוכניות ישנות, גלריה, החלפת שפה). ויקימדיה מגבילה קצב (429): 50 פריטי ויקידאטה לבקשה, ערכי ויקיפדיה בזה אחר זה עם השהיה ו-backoff; לכן מילוי ראשון של תוכנית עם הרבה מקומות חדשים לוקח כמה שניות אחרי שהדף כבר מוצג. 4 תבניות הגלריה לא נבנו מחדש — הן מתמלאות בפתיחה.
65. **רשימת חובה (11):** שלב שני בשאלון, אופציונלי, עד 20 מקומות. ביעדי הדמו יש השלמה אוטומטית מהמאגר (`GET /api/places/suggest`, לפי שם בכל השפות); בשאר המדינות (ובכל טקסט חופשי) השם נשמר וכשבונים את התוכנית הוא מאותר: קודם התאמת שם למאגר של הטיול, אחרת חיפוש Nominatim בתוך העיר הראשונה (נוצר מקום `unverified` עם `source: "user"`, שעה ביקור, `iconicity 0.8`). מקום ברשימה מקבל +1 בניקוד (מעל כל מקום רגיל, שהניקוד שלו 0–1) ועוקף את המסננים הרכים (כבר ראיתי, מחיר, ילדים), לא את שעות הפתיחה. אם לא נכנס לאף יום או לא אותר — אזהרה בתוכנית עם השם, לא השמטה שקטה. הביקור מסומן ב-reason `must_visit` ("ברשימת החובה שלכם"). שלושה שינויים במנוע היו נחוצים כדי שהניקוד באמת יתורגם לשיבוץ: (א) `assign.ts`: ביום מלא, אשכול שמכיל מקום מהרשימה נבחר לפני דירוג הערך (אחרת אשכול קטן ורחוק עם מקום אחד לא זוכה ביום לעולם); (ב) `schedule.ts`: מקומות מהרשימה נכנסים ראשונים בסדר הביקורים, לפני מסלול ה-TSP (אחרת מקום רחוק בקצה האשכול מגיע אחרון ונשאר בחוץ כשתקציב היום נגמר); (ג) `index.ts`: מקום מהרשימה שנשאר בחוץ ביום אחד חוזר כמועמד ביום הבא באותה עיר.
66. **מסעדות ליד כל ארוחה (11):** בקשת Overpass אחת לכל תוכנית (`src/lib/providers/nearby.ts`): מסעדות/בתי קפה ברדיוס 500 מ' מהתחנה שלפני כל ארוחת צהריים, וברדיוס 900 מ' מהמלון לארוחת ערב. אין דירוגים ב-OSM, לכן הדירוג הוא לפי שלמות הרשומה (אתר, שעות, מטבח, Wikidata) ואז מרחק, עד 6, עם מגוון סוגים. ליד כל רשימה קישור לחיפוש ב-Google Maps (דירוגים שאין לנו) והערה שהמקור OSM ולא נבדק. מזון מהיר רק לתקציב "חסכוני". **בחירה שלא נעשתה:** אין ספק מסעדות בתשלום (Google Places, Yelp) — עולה כסף ומחייב מפתח; אפשר להוסיף כספק מאחורי אותו interface.
67. **ערבים (11):** שדה `evening` בהעדפות (רגוע / תרבות / חיי לילה / בלי ערבים; ברירת מחדל רגוע), נשאל בשלב תחומי העניין. לכל יום (חוץ מיום היציאה) בלוק "בערב": ארוחת ערב ליד המלון, מקומות לפי הסגנון ברדיוס 1.5 ק"מ מהמלון (תצפיות/גלידה/בר יין; תיאטרון/מוזיקה חיה/קולנוע; מועדונים/ברים/קזינו), אירועים אמיתיים לתאריך דרך Ticketmaster Discovery כשיש `TICKETMASTER_API_KEY` (חינמי; **לא נבדק מול ה-API האמיתי**, אין מפתח), ובלי מפתח הודעה כנה + קישורי חיפוש לתאריך: GetYourGuide/Viator (שותפים, סיורי ערב), Eventbrite, Songkick, Ticketmaster (תרבות), Resident Advisor (חיי לילה). הקישורים נבנים באותו בונה קישורים (`eveningLinks`) ומופיעים בדף הגילוי בקבוצה "אירועים וערבים". ילדים: ה-planner כבר לא משבץ `nightlife` עם ילדים; סגנון הערב הוא בחירת המשתמש ולא מסונן.
68. **רענון לתוכניות ישנות (11):** `LINKS_VERSION` עלה ל-3 ו-`POST /api/plan/links` מחזיר גם `dining` ו-`evenings`, כך שתוכניות שמורות והגלריה מקבלות מסעדות וערבים בפתיחה הבאה בלי בנייה מחדש.
69. **5 תחומי עניין ואטרקציות (12):** הדירוג בשאלון הורחב ל-5 (משקלים 1 / 0.85 / 0.7 / 0.6 / 0.5; שלושת הראשונים כמו קודם כדי לא לשנות תוכניות קיימות). תחום עניין חדש "אטרקציות ופארקים" (תג `attractions` על גני חיות, אקווריומים, פארקי שעשועים, מגדלים וחוויות בתשלום: 21 מקומות בסיד, וב-OSM לפי הקטגוריה).
70. **"מה קורה בתקופה שלכם" (12):** אין מקור חינמי אמין לאירועים עונתיים, לכן `data/seasonal.json` הוא קובץ מאוצר (18 פריטים לשלושת יעדי הדמו: פסטיבלים, פריחה ושלכת, שווקים ותאורות, ו"שימו לב" כמו שבוע הזהב ופראגוסטו) עם חלון MM-DD (יכול לחצות שנה), עיר או מדינה, וקישור למקור הרשמי. מוצג בשלב התאריכים ומעל התוכנית, תמיד עם "התאריכים המדויקים משתנים משנה לשנה". ליעדים שאינם דמו אין פריטים; אירועים אמיתיים לתאריך מגיעים רק דרך Ticketmaster כשיש מפתח (11).
71. **הנחות 65+ (12):** `data/senior-discounts.json`: כלל לכל מדינת דמו (פורטוגל: 50% באתרים ממשלתיים; איטליה: אין הנחת 65+ מאז 2014, חינם בראשון בחודש; יפן: מתקני מחוז טוקיו בהנחה, המוזיאון הלאומי חינם מ-70) ו-17 מקומות ספציפיים, לפי אתרי המכירה הרשמיים, עם קישור למקור. מוצג רק כשיש בן 65+ בקבוצה, ותמיד עם "לאמת בקופה עם תעודה". לא נכתב שום דבר על מקום שלא נבדק.
72. **מקום שהמערכת לא מכירה ברשימת החובה (12, הדוגמה של טל: מסעדת Vapiano):** עד עכשיו כל מקום חופשי נהיה "אתר מפורסם" לשעה, בבוקר. עכשיו ה"סריקה" היא: Nominatim מחזיר class/type (למשל amenity/restaurant) ומהם נגזרים הקטגוריה, משך הביקור, פנים/חוץ והתגים (`classifyOsmKind`); שעות פתיחה ואתר מ-extratags; ובלי מזהה Wikidata נשלף תיאור קצר מחיפוש Wikidata ("Restaurant chain"). מסעדה מהרשימה משובצת כארוחה: הראשונה תופסת את חלון הצהריים במקום "ארוחת צהריים" גנרית (עם reason של הרשימה ושל הארוחה), השנייה ארוחת ערב מ-18:30, ומה שלא נכנס חוזר ליום הבא. "היום עמוס מדי" ו"בנה מחדש" לא מפילים יותר מקום מהרשימה (מתנהג כנעול). בדיקות יחידה על כל אחד מאלה.
73. **פריסה (13):** SQLite לא עובד ב-Vercel (מערכת קבצים לקריאה בלבד), ו-Prisma לא יודע להחליף ספק לפי סביבה, לכן הסכימה עברה ל-PostgreSQL בכל מקום. הפיתוח המקומי עובד מול אותו מסד Neon (מחרוזת החיבור ב-`.env`), או בלי מסד בכלל: כל הקריאות למסד עטופות ב-fallback (מטמון מקומות, תיאורים), ותכנון אורח לא נוגע במסד. מה שכן דורש מסד: קישורי שיתוף, חשבונות, תכנון משותף. הבנייה ב-Vercel מריצה `prisma db push --accept-data-loss` ו-`db:seed` (upsert, אידמפוטנטי, ~30 שניות) בכל פריסה. הסיכון: שינוי סכימה שמוחק עמודות יעבור בלי שאלה; לפני שינוי כזה מגבים ב-Neon. `AUTH_DEMO_LOGIN` אסור באתר חי (כניסה בשם כל מייל). branch הייצור: `main`. **תקציב זמן:** הפריסה הראשונה נכשלה ב-`/api/plan` עם timeout של 60 שניות (Vercel Hobby). התיקון: `maxDuration = 120` (Fluid compute מאפשר עד 300), ניתוב + מטבע + מסעדות רצים במקביל ב-`enrichPlan`, שני שרתי Overpass במרוץ עם timeout של 15 שניות במקום 40 בזה אחר זה, תיאורי ויקיפדיה בזמן הבנייה רק למקומות שבתוכנית ועם deadline של 12 שניות (השאר נמשך בפתיחת הטיול), וזמני כל שלב נכתבים ל-`notes` (`timing: ...`) וללוג של Vercel. מקומית: ~18 שניות בצד השרת, מהן 15 המתנה ל-Overpass כשהוא עמוס. **Overpass מ-Vercel:** כל ארבעת השרתים הציבוריים (overpass-api.de, kumi, private.coffee, osm.jp) מסרבים או לא עונים לחיבור מהשרתים של Vercel (fetch failed / timeout), גם ב-GET. לכן מסעדות ומקומות ערב ליעדי הדמו נארזים עם האפליקציה: `npm run data:venues` (מהמחשב שלי, שם Overpass עונה) שומר ב-`data/venues/{cc}.json` את 40 מקומות האוכל ו-25 מקומות הערב המלאים ביותר ברדיוס 1.6 ק"מ מכל אטרקציה מאוצרת; בזמן ריצה `src/lib/data/venues.ts` עונה מהקובץ, ו-Overpass נשאר רק לערים שאינן דמו (best effort, עם הערה ב-notes כשנכשל).
64. **תיאור בשפת הממשק גם כשאין ערך בוויקיפדיה (10, בקשת טל):** שלוש שכבות. (א) למקומות הדמו שיש להם רק ערך באנגלית, הטקסט העברי הוא תרגום של הפתיח האנגלי שתרגם Claude בזמן הפיתוח (73 מקומות), מסומן `translatedFrom: "en"` ומוצג עם "(תרגום אוטומטי, ויקיפדיה)" וקישור לערך האנגלי. (ב) בזמן ריצה, לכל שפת ממשק: כשיש `ANTHROPIC_API_KEY` המערכת מתרגמת את הפתיח האנגלי דרך Claude (`src/lib/providers/translate.ts`, מודל `ANTHROPIC_TRANSLATE_MODEL`, ברירת מחדל Haiku 4.5, עד 40 טקסטים בבקשה, tool-use), שומרת ב-DB ומסמנת. **לא נבדק מול ה-API האמיתי** (אין מפתח) — נבדק רק שהקוד מתקמפל ושבלי מפתח שום דבר לא נשלח. (ג) בלי מפתח: הטקסט האנגלי מוצג עם קישור "תרגום ב-Google" (translate.google.com עם הטקסט בכתובת; חינמי, בלי מפתח, נפתח בלשונית חדשה). התוכנית זוכרת לאילו שפות כבר ביקשה תיאורים (`summariesFor`) כדי לא לפנות לוויקימדיה בכל פתיחה. גם 4 מזהי ויקידאטה שגויים בקבצי ה-seed תוקנו (מרכז התרבות בלן, אומוידה יוקוצ'ו, חור המנעול באוונטין, אגם אשי).


---

## 10. דברים במסמך שאינם ריאליים / דורשים תיאום ציפיות

הוראה 11 במסמך ביקשה לומר ולא להמציא פתרון שקט. אז:

1. **"עובד במלואו בלי אף מפתח API" מול "כל מדינות העולם":** בלי מפתח, ה-POIs מגיעים מ-Overpass (OSM). זה חינמי אבל **איטי (5–30 שניות לשאילתה), מוגבל בקצב, ולפעמים נופל**. הדאטה של OSM גם לא אחיד: בפריז יש שעות פתיחה לרוב האתרים, בכפר בגאורגיה כמעט לא. לכן: **3 יעדי הדמו יעבדו מצוין תמיד; שאר העולם יעבוד "כמיטב היכולת" עם הרבה `unverified`.** זה לא באג, זו מציאות הדאטה. ראה שאלה 2.
2. **`iconicity` ו-`visitMinutes`:** אין מקור חינמי לזה. ל-3 יעדי הדמו אכתוב ידנית. לשאר — היוריסטיקה (קיום ערך Wikipedia / Wikidata, קטגוריה) ומסומן כמוערך.
3. **"אסור לשבץ מוזיאון ביום סגירה":** ניתן לאכוף רק כשיש שעות פתיחה. כשאין — אזהרה "לא אומת", לא חסימה. אחרת רוב העולם יהיה ריק.
4. **Lighthouse 90+ בכל הקטגוריות** עם MapLibre + 12 שפות: נגישות/best-practices/SEO 100 בכל הדפים שנמדדו. ביצועים אחרי 8c: בית 85–90, "לדעת לפני" ~88, שאלון ~79 (מובייל מדומה, מחשב מקומי, מדיאן 3 ריצות). המכשול שנשאר הוא ה-hydration של React/Next (~1 שנייה במכשיר מדומה) ולא הקוד של האפליקציה; ראה הנחות 57–58. Framer Motion הוסר לטובת CSS.
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
| 6 | ✅ הושלם | 2026-09-04 | `milestone-6-providers` | שכבת ספקים ב-`src/lib/providers/` עם interface + אמיתי + mock לכל קטגוריה: ניתוב OSRM (זמני הליכה/רכיבה/נסיעה אמיתיים), Open-Meteo (תחזית 16 יום או "שנה שעברה"), Nager.Date (חגים), Frankfurter (מטבע), Nominatim + Overpass (כל מדינות העולם, עם cache ב-DB), קישורי הזמנה דרך `buildAffiliateLink` אחד. הכול בלי מפתחות; `TRIPLAN_OFFLINE=true` מאלץ mocks |
| 7 | ✅ הושלם | 2026-09-04 | `milestone-7-export-offline` | ייצוא ICS/GPX/KML (לקוח), דף הדפסה/PDF, קישור שיתוף (צפייה או עריכה, נשמר ב-DB), PWA עם service worker: דפים network-first, אריחי מפה cache-first, דף אופליין; "הורד למצב אופליין" שומר את המפה של האזורים; תקציב מוערך, רשימת ציוד חכמה, צ'ק-ליסט עם תאריכי יעד והתראות |
| 8a | ✅ הושלם | 2026-09-04 | `milestone-8a-locales` | 12 שפות (10 חדשות תורגמו על ידי Claude, 651 מחרוזות כל אחת, דורשות ביקורת דובר שפת אם), ערבית RTL, Rubik ב-4 subsets + גופני מערכת ל-CJK/הינדי, מתג ק"מ/מייל בתפריט השפה, 24 בדיקות Playwright לשפות (lang/dir/RTL/אין מפתחות חסרים), `npm run lighthouse` (Chromium של Playwright). תיקוני נגישות מ-Lighthouse: ניגודיות כפתור ראשי, `<li>` תקין ברשימת "איך זה עובד", שם נגיש לכרטיסי מדינה. Lighthouse (מובייל, build ייצור, מחשב מקומי): נגישות/best-practices/SEO 100 בכל הדפים שנמדדו; ביצועים 63–85 (LCP 3–4 שניות, TBT עד 1.5 שניות בשאלון). יעד 90+ בביצועים נשאר ל-8b |
| 8b | ✅ הושלם | 2026-09-04 | `milestone-8b-accounts` | Auth.js v5 עם Prisma adapter (טבלאות Account/Session/VerificationToken), כניסה בקישור למייל (Resend כשיש מפתח, אחרת קישור דמו על המסך) ו-Google כשיש מפתחות; `TripSync`: טיולי אורח עולים לחשבון בכניסה, כל שינוי מקומי נשמר לשרת, טיולים מהחשבון מתמזגים ל-localStorage (`/api/trips`); פרופיל מטייל (`/profile`, `/api/profile`) שממלא שאלון חדש; "כבר ביקרתי כאן" בתפריט כל אטרקציה (`/api/visited`) שמוציא מהתוכנית ומהטיולים הבאים; יומן טיול (טאב "יומן": טקסט ודירוג לכל יום, נשמר עם הטיול); גלריה של 4 תוכניות מוכנות מ-`data/templates/` (`npm run data:templates`) עם "העתק לטיולים שלי". 2 בדיקות e2e חדשות (כניסה+מיגרציה, גלריה→ביקרתי→יומן→פרופיל→שאלון) |
| 8c | ✅ הושלם | 2026-09-05 | `milestone-8c-collab-ai-perf` | תכנון משותף: קישור הזמנה (עורך/צופה, מתחלף/מבוטל), חברים, הצבעות 👍👎 על כל אטרקציה, הערות (לטיול/ליום), polling כל 30 שניות, "האחרון מנצח"; צופה רואה בלבד. צ'אט AI: `POST /api/chat` עם Anthropic tool-use שמחזיר רק פעולות עריכה מובנות (אותו `EditOp`), מסונן מול מזהים אמיתיים, ומופעל דרך `/api/plan/edit` הרגיל; בלי מפתח הטאב מסביר "דורש מפתח". ביצועים: תוקן import של radix-ui שמשך את כל הספרייה (−80KB), Framer Motion הוחלף ב-CSS (−40KB), שלבי השאלון בקבצים נפרדים, הודעות i18n נשלחות ללקוח לפי דף ולא כל הקטלוג, דגלים מאוחסנים מקומית (`npm run data:flags`), CSS מוטמע ב-HTML, בלי prefetch לניווט, אינדקס המדינות מרונדר בשרת (24 ראשונות + "הצג הכל"); תוקן באג גלישה אופקית ב-RTL. Lighthouse (מדיאן 3 ריצות, מובייל מדומה, מחשב מקומי): בית 85–90, שאלון ~79, "לדעת לפני" ~88; נגישות/best-practices/SEO 100. 2 בדיקות e2e חדשות (שני משתמשים משתפים פעולה; צ'אט בלי מפתח) |
| 9 | ✅ הושלם | 2026-09-05 | `milestone-9-links-navigation` | קישורים עמוקים לכל 12 אתרי השותפים (עיר באנגלית + תאריכים + נוסעים), שדה "מאיפה טסים" בשאלון, השכלת רכב (Rentalcars, Discover Cars) למי שבחר רכב, `AFFILIATE_QUERY_<אתר>` לכל תוכנית + `docs/affiliates.md`, הסבר על כל אתר ב-12 שפות (מתחת לקישורים ובדף הגילוי עם סטטוס פעיל/רגיל), כפתור "נווטו את היום ב-Google Maps" לכל יום, מסלולים על רחובות אמיתיים במפה דרך `POST /api/route` (OSRM). e2e חדש לכל זה |
| 13 | ✅ הושלם | 2026-09-06 | `milestone-13-deploy` | האתר חי ב-https://triplan-rho.vercel.app (Vercel Hobby + Neon Free בפרנקפורט). Prisma ל-PostgreSQL, `vercel.json`, `docs/deploy.md`. הפריסה הראשונה נכשלה ב-timeout של 60 שניות ותוקנה (סעיף 73). תכנון אורח, רשימת חובה, 65+ ותיאורים נבדקו מול האתר החי |
| 12 | ✅ הושלם | 2026-09-05 | `milestone-12-interests-seasonal-seniors` | 5 תחומי עניין מדורגים + "אטרקציות", "מה קורה בתקופה שלכם" (18 פריטים מאוצרים עם מקורות, בשלב התאריכים ומעל התוכנית), הנחות 65+ (כללי מדינה + 17 מקומות, רק כשיש בן 65+), רשימת חובה: סיווג מ-OSM + תיאור מ-Wikidata, מסעדה משובצת בצהריים/ערב, לא נופלת בעריכות. `LINKS_VERSION` 4 כדי שתוכניות ישנות יקבלו את הבלוקים בפתיחה |
| 11 | ✅ הושלם | 2026-09-05 | `milestone-11-wishlist-dining-evenings` | שלב "חובה לבקר" (השלמה מהמאגר, טקסט חופשי מאותר ב-Nominatim, +1 בניקוד, אזהרה אם לא נכנס), מסעדות ליד כל ארוחה וארוחת ערב ליד המלון מ-OpenStreetMap (Overpass, בקשה אחת לתוכנית), סגנון ערב בשאלון ובלוק "בערב" לכל יום עם מקומות, אירועים (Ticketmaster כשיש מפתח) וקישורי חיפוש לתאריך ב-4 אתרים חדשים בדף הגילוי. 12 שפות (84 מפתחות חדשים), בדיקות יחידה ל-planner/סיווג/קישורים, e2e מלא |
| 10 | ✅ הושלם | 2026-09-05 | `milestone-10-place-descriptions` | שורת תיאור לכל אטרקציה בכרטיס, בתצוגת "עכשיו" ובהדפסה: פתיח ויקיפדיה בשפת הממשק (או תיאור ויקידאטה, או קטגוריה), עם קישור למקור. `summary` על המקום (seed he+en דרך `npm run data:summaries`, עמודה ב-DB, צילום בתוכנית), מילוי אוטומטי בבנייה/עריכה ובפתיחת תוכניות ישנות דרך `POST /api/places/summaries`. 27 שמות קטגוריות ב-12 שפות. בדיקות יחידה לחיתוך הטקסט, e2e על תוכנית מהגלריה. **תוספת באותו יום (בקשת טל):** תיאור בעברית גם כשאין ערך עברי — תרגום מוכן מראש ל-73 מקומות הדמו, תרגום בזמן ריצה לכל שפה דרך Claude כשיש מפתח, וקישור "תרגום ב-Google" בלי מפתח; הכול מסומן כתרגום |

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
