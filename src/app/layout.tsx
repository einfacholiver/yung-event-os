import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "YUNG Event OS",
  description: "Technische Grundlage für YUNG Event OS",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <nav
          aria-label="Arbeitsbereiche"
          className="flex flex-wrap gap-4 border-b bg-stone-100 px-6 py-3 text-sm"
        >
          {[
            ["/", "Start"],
            ["/events", "Events"],
            ["/documents", "Documents"],
            ["/finances", "Finanzen"],
            ["/invoices", "Rechnungen"],
            ["/tasks", "Tasks"],
            ["/analytics", "Analytics"],
            ["/settings/integrations/google-drive", "Google Drive"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </body>
    </html>
  );
}
