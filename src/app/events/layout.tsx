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
      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">{children}</main>
    </div>
  );
}
