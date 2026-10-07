"use client";
import { useState } from "react";
import { ApiForm } from "@/modules/workspace/components/api-form";
import { PdfPreview } from "@/modules/documents/components/pdf-preview";

export type InvoiceDocument = {
  id: string;
  name: string;
  path: string;
  category?: string;
  mimeType: string;
  externalId: string;
  trashed?: boolean;
};

export function TransactionInvoice({
  id,
  eventId,
  direction,
  document,
  documents,
}: {
  id: string;
  eventId: string;
  direction: string;
  document?: InvoiceDocument | null;
  documents: InvoiceDocument[];
}) {
  const [expanded, setExpanded] = useState(false);
  const available = documents.filter(
    (file) =>
      file.category === (direction === "EXPENSE" ? "EXPENSES" : "INCOME"),
  );
  return (
    <div className="min-w-56 space-y-2">
      <span
        className={`inline-block rounded-full px-2 py-1 text-xs ${document && !document.trashed ? "status-success" : "status-warning"}`}
      >
        {document
          ? document.trashed
            ? "Rechnung nicht mehr verfügbar"
            : "Rechnung hinterlegt"
          : "Keine Rechnung"}
      </span>
      {document && (
        <>
          <a
            className="block text-sm underline"
            href={`https://drive.google.com/file/d/${encodeURIComponent(document.externalId)}/view`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {document.name} ↗
          </a>
          {!document.trashed && document.mimeType === "application/pdf" && (
            <PdfPreview
              src={`/api/events/${eventId}/documents/${document.id}/preview`}
              name={document.name}
            />
          )}
        </>
      )}
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="cursor-pointer text-sm">
          {document ? "Verknüpfung ändern" : "Rechnung zuordnen"}
        </summary>
        {expanded && (
          <ApiForm
            key={document?.id ?? "none"}
            endpoint={`/api/finances/transactions/${id}/invoice`}
            method="PATCH"
            reset={false}
            className="mt-3 space-y-3"
          >
            <label className="block text-sm">
              Rechnung aus diesem Event
              <select
                className="bg-card mt-1 block w-full max-w-lg rounded border p-2"
                name="driveItemId"
                defaultValue={document?.id ?? ""}
              >
                <option value="">Keine Rechnung / Verknüpfung entfernen</option>
                {document &&
                  !available.some((file) => file.id === document.id) && (
                    <option value={document.id}>
                      {document.name} (bisherige Zuordnung)
                    </option>
                  )}
                {available.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.path}
                  </option>
                ))}
              </select>
            </label>
            {!available.length && (
              <p className="text-muted-foreground text-xs">
                Noch keine passenden Rechnungen. Unter Dokumente hochladen oder
                Drive synchronisieren.
              </p>
            )}
            <button className="bg-primary text-primary-foreground rounded px-3 py-2">
              Verknüpfung speichern
            </button>
          </ApiForm>
        )}
      </details>
    </div>
  );
}
