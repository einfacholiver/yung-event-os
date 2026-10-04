import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Events | YUNG Event OS", template: "%s | YUNG Event OS" },
};
export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
          <Link href="/" className="text-xl font-black tracking-tight">
            YUNG
            <span className="text-muted-foreground ml-2 text-xs font-medium tracking-widest">
              EVENT OS
            </span>
          </Link>
          <Link
            href="/events"
            className="rounded-md bg-stone-100 px-4 py-2 text-sm font-medium"
          >
            Events
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">{children}</main>
    </div>
  );
}
