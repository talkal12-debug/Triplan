# פריסה לאינטרנט: Vercel + Neon (מסד נתונים)

מדריך צעד-צעד לטל. הכול בחינם (תוכניות Hobby/Free), בלי כרטיס אשראי.
הקוד כבר מוכן לזה: `vercel.json` מגדיר את הבנייה, ו-Prisma עובד מול PostgreSQL.

## מה יש לנו ומה צריך

| דבר | מצב |
|---|---|
| חשבון GitHub | יש |
| הקוד ב-GitHub | Claude דוחף (push) מהמחשב; בפעם הראשונה ייפתח חלון של GitHub לאישור |
| חשבון Vercel | ליצור (עם GitHub) |
| מסד נתונים | Neon דרך Vercel Marketplace (חינמי), נוצר בלחיצה |
| מפתחות | רק `AUTH_SECRET` (מחרוזת אקראית ש-Claude מייצר). כל השאר אופציונלי |

## שלב 1: הקוד ב-GitHub (Claude עושה)

1. באתר GitHub: הכפתור **+** למעלה מימין → **New repository**.
2. Repository name: `triplan`. משאירים **Private**. **לא** מסמנים "Add a README". לוחצים **Create repository**.
3. אומרים ל-Claude "יצרתי". Claude מריץ `git push`. אם נפתח חלון דפדפן של GitHub, מאשרים (Authorize).

## שלב 2: חשבון Vercel

1. נכנסים ל-https://vercel.com/signup ולוחצים **Continue with GitHub**. מאשרים.
2. שואלים על שם/סוג חשבון: **Hobby**, השם שלך. ממשיכים.

## שלב 3: מסד נתונים (Neon)

1. בדף הבית של Vercel: למעלה **Storage** → **Create Database** → בוחרים **Neon** (Serverless Postgres) → **Continue**.
2. Region: **Frankfurt (eu-central-1)** (הכי קרוב לישראל). תוכנית **Free**. שם: `triplan-db`. **Create**.
3. כשמסיימים, Vercel מציע "Connect Project". עדיין אין פרויקט, אז סוגרים; נחבר בשלב הבא.

## שלב 4: הפרויקט

1. בדף הבית של Vercel: **Add New…** → **Project**.
2. ברשימת ה-repositories מ-GitHub מחפשים `triplan` → **Import**. (אם הרשימה ריקה: **Adjust GitHub App Permissions** ומאשרים גישה ל-repository.)
3. במסך ההגדרות:
   - Framework Preset: **Next.js** (מזוהה לבד).
   - Build and Output Settings: לא נוגעים (`vercel.json` קובע).
   - **Environment Variables**: מוסיפים שורה אחת:
     - Name: `AUTH_SECRET`, Value: המחרוזת ש-Claude נתן (32 תווים אקראיים). **Add**.
4. לוחצים **Deploy**. הבנייה הראשונה נכשלת כי עוד אין מסד נתונים מחובר. זה צפוי, ממשיכים לשלב 5.

## שלב 5: לחבר את המסד לפרויקט

1. בפרויקט: לשונית **Storage** → ליד `triplan-db` לוחצים **Connect**. Environments: משאירים את כולם מסומנים. **Connect**.
   (זה מוסיף לבד את `DATABASE_URL` ועוד משתנים למשתני הסביבה של הפרויקט.)
2. לשונית **Deployments** → על הפריסה שנכשלה: תפריט **⋯** → **Redeploy** → **Redeploy**.
3. מחכים 3–5 דקות. הבנייה: יוצרת את הטבלאות (`prisma db push`), טוענת את 250 המדינות ו-207 האטרקציות (`db:seed`), ובונה את האתר.
4. כשמופיע **Ready**: לוחצים **Visit**. הכתובת תהיה משהו כמו `https://triplan-xxxx.vercel.app`. זה האתר, זמין תמיד ומכל מכשיר.

## שלב 6 (אופציונלי): שהמחשב המקומי יעבוד מול אותו מסד

הפיתוח המקומי (`npm run dev`) עדיין עובד גם בלי זה (תכנון אורח לא צריך מסד), אבל קישורי שיתוף, חשבונות ותכנון משותף כן צריכים:

1. ב-Vercel: לשונית **Storage** → `triplan-db` → **.env.local** tab → **Copy Snippet**.
2. פותחים במחשב את הקובץ `triplan\.env` (ב-Notepad), מוחקים את השורה `DATABASE_URL="file:./dev.db"` ומדביקים את השורות שהועתקו. שומרים.
3. אומרים ל-Claude "עדכנתי את .env" והוא מפעיל את השרת מחדש.

## אירועים והופעות אמיתיים (Ticketmaster, חינם, 5 דקות)

בלי מפתח, בלוק הערב מציע קישורי חיפוש. עם מפתח חינמי של Ticketmaster הוא מציג אירועים אמיתיים בתאריכי הטיול, עם מחיר וכפתור "לרכישת כרטיסים":

1. נכנסים ל-https://developer.ticketmaster.com ולוחצים **Get Your API Key** (למעלה מימין). נרשמים עם מייל וסיסמה ומאשרים את המייל.
2. אחרי הכניסה: **My Apps** → **Add a New App**. שם: `Triplan`, תיאור קצר, ולוחצים **Create App**.
3. בדף האפליקציה מופיע **Consumer Key**. זה המפתח (מחרוזת של ~32 תווים). מעתיקים אותו.
4. ב-Vercel: הפרויקט → **Settings** → **Environment Variables** → **Add**. Key: `TICKETMASTER_API_KEY`, Value: המפתח שהעתקתם. **Save**.
5. **Deployments** → על הפריסה האחרונה **⋯** → **Redeploy**.

מגבלת החינם: 5,000 קריאות ביום, מספיק. הכיסוי הטוב ביותר בצפון אמריקה ובמערב אירופה; באסיה חלקי. כדי לקבל עמלה על כרטיסים (Ticketmaster affiliate דרך Impact) מוסיפים גם `AFFILIATE_QUERY_TICKETMASTER`, ראו `docs/affiliates.md`.

## מה עוד אפשר להוסיף אחר כך (משתני סביבה ב-Vercel → Settings → Environment Variables)

| משתנה | מה נותן | איפה מקבלים |
|---|---|---|
| `AUTH_RESEND_KEY` + `AUTH_EMAIL_FROM` | כניסה בקישור למייל (בלי זה אין כניסה באתר החי) | https://resend.com (חינמי, דורש דומיין או כתובת בדיקה) |
| `ANTHROPIC_API_KEY` | עוזר ה-AI + תרגום ההסברים לכל שפה | https://console.anthropic.com |
| `TICKETMASTER_API_KEY` | אירועים אמיתיים בבלוק הערב | https://developer.ticketmaster.com |
| `AFFILIATE_*` | עמלות מהקישורים | ראו `docs/affiliates.md` |

אחרי כל שינוי במשתני סביבה: **Deployments** → **Redeploy**.

## מה קורה בכל push

כל `git push` ל-branch `main` ב-GitHub מפעיל פריסה חדשה ב-Vercel לבד (2–5 דקות). Claude דוחף ל-`main` בסוף כל milestone; בין לבין אפשר לבקש "תעלה את הגרסה החדשה".

## אזהרות כנות

- **אל תפעילו `AUTH_DEMO_LOGIN=true` באתר החי.** זה מאפשר לכל אחד להיכנס בשם כל כתובת מייל. זה טוב רק למחשב שלכם.
- Neon Free: 0.5GB, המסד "נרדם" אחרי 5 דקות בלי שימוש והבקשה הראשונה אחריו איטית (2–3 שניות). לא קריטי: התכנון עצמו לא תלוי במסד.
- Vercel Hobby: לשימוש אישי/לא-מסחרי לפי התנאים שלהם. כשיהיו הכנסות מקישורי שותפים, לעבור ל-Pro ($20 לחודש).
- הבנייה מריצה `prisma db push` בכל פריסה. כשמשנים סכימה באופן שמוחק נתונים, זה יעבור בלי לשאול (`--accept-data-loss`). לפני שינוי כזה: גיבוי ב-Neon (Branches → Create branch).
