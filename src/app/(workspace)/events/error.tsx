"use client";
import { Button } from "@/components/ui/button";

export default function EventsError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="bg-card rounded-xl border p-8">
      <h1 className="text-2xl font-semibold">
        Events konnten nicht geladen werden
      </h1>
      <p className="text-muted-foreground mt-3 mb-6">
        Bitte versuche es noch einmal. Falls das Problem bestehen bleibt, prüfe
        die Verbindung zur Datenbank.
      </p>
      <Button onClick={reset}>Erneut versuchen</Button>
    </section>
  );
}
