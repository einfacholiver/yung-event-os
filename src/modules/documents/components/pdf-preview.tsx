"use client";
import { useEffect, useState } from "react";
export function PdfPreview({ src, name }: { src: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        const response = await fetch(src, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error ?? "PDF konnte nicht geladen werden.");
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "PDF konnte nicht geladen werden.",
          );
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, src]);
  return (
    <div className="mt-3 space-y-3">
      <button
        className="rounded border bg-white px-4 py-2 text-sm"
        aria-expanded={open}
        onClick={() => {
          setError("");
          setUrl(null);
          setOpen(!open);
        }}
      >
        {open ? "Vorschau schließen" : "PDF-Vorschau öffnen"}
      </button>
      {open && (
        <div>
          {error ? (
            <p role="alert" className="p-3 text-sm text-red-800">
              {error}
            </p>
          ) : url ? (
            <iframe
              src={url}
              title={`PDF-Vorschau: ${name}`}
              className="h-[70vh] w-full rounded border bg-white"
            />
          ) : (
            <p role="status" className="p-3 text-sm">
              PDF wird geladen …
            </p>
          )}
        </div>
      )}
    </div>
  );
}
