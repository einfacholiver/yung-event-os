"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTransaction({
  id,
  description,
  amount,
  onDeleted,
}: {
  id: string;
  description: string | null;
  amount: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/finances/transactions/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.error ?? "Löschen fehlgeschlagen. Bitte erneut versuchen.",
        );
        return;
      }
      onDeleted?.();
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte erneut versuchen.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-2 border-t p-3">
      {confirming ? (
        <>
          <p>
            „{description || "Buchung ohne Beschreibung"}“ ({amount} EUR)
            wirklich löschen? Die Buchung wird aus den Finanzsummen entfernt.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              className="bg-destructive text-primary-foreground rounded px-3 py-2 disabled:opacity-50"
              onClick={remove}
            >
              {pending ? "Löscht …" : "Endgültig löschen"}
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded border px-3 py-2"
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
            >
              Abbrechen
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="border-destructive/50 rounded border px-3 py-2 text-red-300"
          onClick={() => setConfirming(true)}
        >
          Löschen
        </button>
      )}
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
