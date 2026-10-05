import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { loginAdmin } from "@/server/auth/actions";
import { AccessError, requireAdmin } from "@/server/auth/access";

export const metadata = {
  title: "Anmelden | YUNG Event OS",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let signedIn = false;
  try {
    await requireAdmin();
    signedIn = true;
  } catch (error) {
    if (!(error instanceof AccessError)) throw error;
  }
  if (signedIn) redirect("/events");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="event-card bg-card w-full max-w-md space-y-6 rounded-2xl border p-8 sm:p-10">
        <Image
          src="/brand/yung-logo.png"
          alt="YUNG"
          width={180}
          height={110}
          priority
          className="h-24 w-auto"
        />
        <div className="space-y-3">
          <p className="text-primary flex items-center gap-2 text-sm font-medium">
            <LockKeyhole className="size-4" />
            Privater Admin-Bereich
          </p>
          <h1 className="text-3xl font-semibold">YUNG Event OS</h1>
          <p className="text-muted-foreground text-sm">
            Melde dich mit deinem freigegebenen Google-Konto an, um deine Events
            zu verwalten.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="status-error rounded-lg border p-3 text-sm"
          >
            Die Anmeldung wurde nicht abgeschlossen. Verwende das freigegebene
            Admin-Konto und versuche es erneut.
          </p>
        )}
        <form action={loginAdmin}>
          <Button type="submit" className="w-full">
            Mit Google anmelden
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">
          Nur für den Administrator. Eine Registrierung ist nicht möglich.
        </p>
      </section>
    </main>
  );
}
