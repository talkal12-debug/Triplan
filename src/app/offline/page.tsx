/**
 * Served by the service worker when a page is not cached and the network is down.
 * Static, bilingual, no locale routing (it must work at any URL).
 */
import Link from "next/link";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="max-w-md text-center">
      <p className="text-5xl" aria-hidden>
        📡
      </p>
      <h1 className="mt-4 text-2xl font-bold">אין חיבור לאינטרנט</h1>
      <p className="mt-2 text-muted-foreground">התוכניות ששמרתם זמינות ב&quot;הטיולים שלי&quot;. חזרו לשם או נסו שוב כשיש רשת.</p>
      <p className="mt-6 text-sm text-muted-foreground" dir="ltr" lang="en">
        You are offline. Saved plans are available under &quot;My trips&quot;.
      </p>
      <Link href="/he/trips" className="mt-6 inline-block rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground">
        הטיולים שלי · My trips
      </Link>
    </main>
  );
}
