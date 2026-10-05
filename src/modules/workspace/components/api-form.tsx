"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ApiForm({
  children,
  endpoint,
  className,
  method = "POST",
  reset = true,
}: {
  children: React.ReactNode;
  endpoint: string;
  className?: string;
  method?: "POST" | "PATCH";
  reset?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className={className}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const body = new FormData(form);
        setSaving(true);
        setMessage("");
        try {
          const response = await fetch(endpoint, { method, body });
          const result = await response.json();
          if (!response.ok) {
            setMessage(result.error ?? "Speichern fehlgeschlagen.");
            return;
          }
          if (reset) form.reset();
          setMessage("Gespeichert");
          router.refresh();
        } catch {
          setMessage("Server nicht erreichbar. Bitte erneut versuchen.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <fieldset disabled={saving} className="contents">
        {children}
      </fieldset>
      <p role="status" className="col-span-full text-sm">
        {saving ? "Speichert …" : message}
      </p>
    </form>
  );
}
