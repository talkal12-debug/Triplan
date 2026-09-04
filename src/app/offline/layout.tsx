import "../globals.css";

/** Standalone shell for the offline fallback page (outside locale routing on purpose). */
export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">{children}</body>
    </html>
  );
}
