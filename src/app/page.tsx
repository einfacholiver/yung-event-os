import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <section className="bg-card text-card-foreground w-full max-w-xl space-y-4 rounded-xl border p-8">
        <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
          Projektbasis
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">YUNG Event OS</h1>
        <p className="text-muted-foreground">
          Deine Events, ihre Details und alle kommenden Arbeitsbereiche an einem
          Ort.
        </p>
        <Button asChild>
          <Link href="/events">Events öffnen</Link>
        </Button>
      </section>
    </main>
  );
}
