import Link from "next/link";
export default function SettingsPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
      <Link
        href="/settings/integrations"
        className="bg-card block rounded-xl border p-6 hover:shadow-sm"
      >
        <h2 className="text-xl font-semibold">Integrations</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Verbindungen zu deinen externen Diensten verwalten.
        </p>
      </Link>
    </>
  );
}
