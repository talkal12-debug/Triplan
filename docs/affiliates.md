# תוכניות שותפים (affiliate) - מדריך הרשמה והגדרה

Triplan מקשר מכל תוכנית טיול לאתרי הזמנה חיצוניים: מלונות, טיסות, השכרת רכב וכרטיסים.
כל קישור נפתח **כבר על העיר, התאריכים ומספר הנוסעים** של הטיול. כשמגדירים מזהה שותף,
אותו קישור מקבל גם פרמטר מעקב, ואתם מקבלים עמלה על הזמנות שנעשות דרכו. בלי מזהה,
הקישורים עובדים בדיוק אותו דבר, רק בלי עמלה. דף `/disclosure` באתר מציג למשתמשים מה פעיל.

**חשוב:** רוב התוכניות דורשות אתר חי עם כתובת אמיתית לפני שמאשרים אותכם.
לכן: קודם מעלים את Triplan לאינטרנט, אחר כך נרשמים.

## איך מגדירים

הקוד קורא את המזהים ממשתני סביבה (ב-Vercel: Settings → Environment Variables; מקומית: קובץ `.env.local`).
אחרי שינוי משתני סביבה צריך לפרוס מחדש (Vercel עושה את זה בלחיצה).

לשש התוכניות הנפוצות יש משתנה ייעודי. לכל השאר יש משתנה כללי בפורמט
`AFFILIATE_QUERY_<שם האתר>` שמכיל את מחרוזת המעקב **בדיוק כפי שהיא מופיעה בקישור שמחולל השותפים של האתר מפיק**
(החלק שאחרי סימן השאלה). דוגמה: אם Agoda נותנים לכם קישור שנגמר ב-`?cid=1234567`, מגדירים
`AFFILIATE_QUERY_AGODA=cid=1234567`.

| אתר | מה זה | היכן נרשמים | משתנה סביבה |
|---|---|---|---|
| Booking.com | מלונות ודירות | https://www.booking.com/affiliate-program/v2/index.html | `AFFILIATE_BOOKING_AID` (המספר `aid` מהקישור) |
| Hotels.com | מלונות (Expedia Group) | https://www.expediagroup.com/affiliates (רשת Impact) | `AFFILIATE_QUERY_HOTELSCOM` |
| Agoda | מלונות, חזק באסיה | https://partners.agoda.com | `AFFILIATE_QUERY_AGODA` (למשל `cid=...`) |
| Hostelworld | הוסטלים | https://www.hostelworld.com/affiliates (רשת Partnerize) | `AFFILIATE_QUERY_HOSTELWORLD` |
| GetYourGuide | כרטיסים וסיורים | https://partner.getyourguide.com | `AFFILIATE_GETYOURGUIDE_PARTNER_ID` |
| Viator | סיורים (TripAdvisor) | https://www.viator.com/affiliates | `AFFILIATE_VIATOR_PID` |
| Tiqets | כרטיסים למוזיאונים | https://www.tiqets.com/en/partners | `AFFILIATE_TIQETS_PARTNER` |
| Klook | כרטיסים, אסיה | https://affiliate.klook.com | `AFFILIATE_KLOOK_AID` |
| Kiwi.com | טיסות | https://www.travelpayouts.com (רשת Travelpayouts) | `AFFILIATE_KIWI_AFFILID` |
| Skyscanner | השוואת טיסות | https://www.partners.skyscanner.net (או דרך Travelpayouts / Impact) | `AFFILIATE_QUERY_SKYSCANNER` |
| Rentalcars.com | השכרת רכב (Booking) | https://www.rentalcars.com/affiliates | `AFFILIATE_QUERY_RENTALCARS` |
| Discover Cars | השוואת השכרת רכב | https://www.discovercars.com/affiliate | `AFFILIATE_QUERY_DISCOVERCARS` (למשל `a_aid=...`) |

הכתובות נכונות לספטמבר 2026. אם קישור ההרשמה זז, חפשו "<שם האתר> affiliate program".

## מה כדאי לדעת

- **עמלות אופייניות** (משתנות): מלונות 3–6% מההזמנה (Booking 25–40% מעמלת Booking עצמה), כרטיסים 8–10%, טיסות 1–3% או סכום קבוע, רכב 5–8%. הנתונים המדויקים בדשבורד של כל תוכנית.
- **Booking.com** דורש בדרך כלל תנועה מינימלית לפני האישור, ואפשר לקבל סירוב ראשון. שווה לנסות שוב אחרי חודש-חודשיים של תנועה.
- **Travelpayouts** מאגדת כמה אתרי טיסות ורכב תחת חשבון אחד (Kiwi, לפעמים Skyscanner, Discover Cars ועוד). זו נקודת התחלה נוחה.
- **הקישורים העמוקים** (עיר + תאריכים) נבנו לפי מבנה הכתובות הציבורי של כל אתר. Rentalcars ו-Discover Cars לא נבדקו מול חשבון שותף: אם מחולל הקישורים שלהם נותן מבנה אחר, זה השינוי היחיד שצריך, בקובץ `src/lib/providers/affiliate.ts`.
- **חובה חוקית**: דף `/disclosure` מסביר למשתמשים על העמלות, וכל קישור מסומן "קישור שותפים" עם `rel="sponsored"`. בישראל ובאיחוד האירופי זה נדרש. אל תסירו את זה.
- **פרטיות**: הקישורים לא מעבירים שום מידע על המשתמש מלבד העיר, התאריכים ומספר הנוסעים שהם עצמם הזינו.

## איך בודקים שזה עובד

1. מגדירים את המשתנה ופורסים מחדש.
2. פותחים תוכנית טיול ולוחצים על קישור. הכתובת שנפתחת צריכה להכיל את פרמטר המעקב (למשל `aid=` או `partner_id=`).
3. ב-`/disclosure` האתר אמור להיות מסומן "קישור שותפים פעיל".
4. בדשבורד של התוכנית אמורות להופיע "לחיצות" תוך יום.
