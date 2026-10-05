"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CalendarDays, FolderSync, ScanLine, Settings2 } from "lucide-react";

const links = [
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/check-in", label: "Check-in System", icon: ScanLine },
  {
    href: "/settings/integrations/google-drive",
    label: "Google Drive",
    icon: FolderSync,
  },
  { href: "/settings", label: "Settings", icon: Settings2 },
];
export function WorkspaceNavigation() {
  const pathname = usePathname();
  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-10">
        <Link
          href="/"
          aria-label="YUNG Event OS Startseite"
          className="flex items-center gap-3"
        >
          <Image
            src="/brand/yung-logo.png"
            alt="YUNG"
            width={96}
            height={59}
            priority
            className="h-12 w-auto object-contain"
          />
          <span className="text-muted-foreground border-l pl-3 text-[10px] font-semibold tracking-[0.2em]">
            EVENT
            <br />
            OS
          </span>
        </Link>
        <nav
          aria-label="Arbeitsbereiche"
          className="flex max-w-full flex-wrap gap-1"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/settings"
                ? pathname.startsWith("/settings") &&
                  !pathname.startsWith("/settings/integrations/google-drive")
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? "bg-primary/10 text-primary ring-primary/25 ring-1" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
