import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-90px)] items-center justify-center p-6 sm:p-8">
      <section className="event-card bg-card text-card-foreground w-full max-w-xl space-y-6 rounded-2xl border p-8 sm:p-12">
        <Image
          src="/brand/yung-logo.png"
          alt="YUNG Logo"
          width={180}
          height={110}
          priority
          className="h-24 w-auto object-contain"
        />
        <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
          Dein Event Workspace
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">YUNG Event OS</h1>
        <p className="text-muted-foreground">
          Deine Events, ihre Details und alle kommenden Arbeitsbereiche an einem
          Ort.
        </p>
        <Button asChild>
          <Link href="/events">Events öffnen</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/integrations/google-drive">
            Anmelden / Google Drive
          </Link>
        </Button>
        <p className="text-muted-foreground text-sm">
          Öffne ein Event für seine Dokumente, Finanzen, Medien und Tickets. Das
          Check-in System wird später angebunden.
        </p>
      </section>
    </main>
  );
}
