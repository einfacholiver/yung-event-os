export default function EventContentLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Event-Bereich wird geladen"
      className="space-y-5"
    >
      <p role="status" className="text-muted-foreground text-sm">
        Event-Daten werden geladen …
      </p>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="bg-card h-28 rounded-xl border motion-safe:animate-pulse"
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="bg-card h-64 rounded-xl border motion-safe:animate-pulse"
      />
    </section>
  );
}
