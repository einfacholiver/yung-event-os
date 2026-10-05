export default function LoadingEvents() {
  return (
    <div role="status" className="space-y-6">
      <p className="text-muted-foreground">Events werden geladen …</p>
      <div className="grid gap-4 md:grid-cols-3" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="bg-muted h-56 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}
