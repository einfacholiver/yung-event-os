"use client";
import { Button } from "@/components/ui/button";
export default function SettingsError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="rounded-xl border p-6">
      <h1 className="text-xl font-semibold">
        Einstellungen konnten nicht geladen werden
      </h1>
      <p className="text-muted-foreground my-4">
        Bitte prüfe die Datenbankverbindung und versuche es erneut.
      </p>
      <Button onClick={reset}>Erneut versuchen</Button>
    </section>
  );
}
