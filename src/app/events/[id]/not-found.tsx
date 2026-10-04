import Link from "next/link";
export default function EventNotFound() {
  return (
    <section className="py-12">
      <h1 className="text-2xl font-semibold">
        Event oder Bereich nicht gefunden
      </h1>
      <p className="text-muted-foreground mt-3">
        Dieser Eintrag ist nicht verfügbar.
      </p>
      <Link
        className="mt-6 inline-block underline underline-offset-4"
        href="/events"
      >
        Zur Event-Übersicht
      </Link>
    </section>
  );
}
