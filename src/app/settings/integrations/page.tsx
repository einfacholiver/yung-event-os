import Link from "next/link";
export default function IntegrationsPage() {
  return (
    <>
      <Link href="/settings" className="text-muted-foreground text-sm">
        ← Settings
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight">Integrations</h1>
      <Link
        href="/settings/integrations/google-drive"
        className="bg-card block rounded-xl border p-6 hover:shadow-sm"
      >
        <h2 className="text-xl font-semibold">Google Drive</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Konto verbinden, Ordner durchsuchen und den Ausgangsordner auswählen.
        </p>
      </Link>
      <Link
        href="/settings/integrations/google-drive/mapping"
        className="bg-card block rounded-xl border p-6 hover:shadow-sm"
      >
        <h2 className="text-xl font-semibold">Drive Mapping</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Event- und Kategorieordner prüfen und manuell zuordnen.
        </p>
      </Link>
    </>
  );
}
