"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { eventTabs } from "../config";

export function EventNavigation({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = "/events/" + encodeURIComponent(eventId);
  return (
    <nav aria-label="Event-Bereiche" className="overflow-x-auto border-b">
      <div className="flex min-w-max gap-1">
        {eventTabs.map((tab) => {
          const href = tab.slug === "overview" ? base : base + "/" + tab.slug;
          const active = pathname === href;
          return (
            <Link
              key={tab.slug}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "border-b-2 px-4 py-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] " +
                (active
                  ? "border-black text-black"
                  : "text-muted-foreground hover:text-foreground border-transparent hover:border-stone-300")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
