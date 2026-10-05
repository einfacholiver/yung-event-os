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
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">{children}</main>
    </div>
  );
}
