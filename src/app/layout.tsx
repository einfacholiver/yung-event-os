import type { Metadata } from "next";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "YUNG Event OS",
  description: "Technische Grundlage für YUNG Event OS",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="dark">
      <body>
        <WorkspaceNavigation />
        {children}
      </body>
    </html>
  );
}
