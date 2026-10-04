import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | YUNG Event OS",
  robots: { index: false, follow: false },
};
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
          <Link href="/" className="text-xl font-black tracking-tight">
            YUNG{" "}
            <span className="text-muted-foreground text-xs font-medium tracking-widest">
              EVENT OS
            </span>
          </Link>
          <nav
            aria-label="Hauptnavigation"
            className="flex items-center gap-4 text-sm"
          >
            <Link href="/events">Events</Link>
            <Link
              href="/settings"
              className="rounded-md bg-stone-100 px-4 py-2 font-medium"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">{children}</main>
    </div>
  );
}
