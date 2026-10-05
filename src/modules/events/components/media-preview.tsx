"use client";
import { useState } from "react";
export function MediaPreview({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="mb-3 rounded bg-stone-100 p-8 text-sm">
        Vorschau nicht verfügbar. Original in Drive öffnen.
      </div>
    );
  // Authenticated same-origin image response; never expose Drive credentials to the browser.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      loading="lazy"
      src={src}
      alt={name}
      className="mb-3 aspect-square w-full rounded object-contain"
      onError={() => setFailed(true)}
    />
  );
}
