import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YUNG Event OS",
  description: "Events, Finanzen und Drive-Dokumente gemeinsam verwalten.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="dark">
      <body>{children}</body>
    </html>
  );
}
