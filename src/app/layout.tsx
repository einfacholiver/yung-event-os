import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YUNG Event OS",
  description: "Events, Finanzen und Drive-Dokumente gemeinsam verwalten.",
  icons: {
    icon: [
      { url: "/brand/yung-tab-v2.png", type: "image/png", sizes: "64x64" },
    ],
  },
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
