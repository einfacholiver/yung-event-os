"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FileSearch, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { euro, totalCents } from "./money";
import type { InvoiceInput, InvoiceSender } from "./schema";
import { SenderFields } from "./sender-fields";

const field =
  "bg-background border-input mt-1 w-full rounded-lg border px-3 py-2.5 text-sm";
const initialItem = () => ({ description: "", quantity: 1, unitPrice: "" });
async function api(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(
      result.error ?? "Anfrage fehlgeschlagen. Bitte erneut versuchen.",
    );
  }
  return response;
}
export function DriveRetry({
  id,
  onUploaded,
}: {
  id: string;
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  if (done)
    return (
      <p role="status" className="text-success text-sm">
        In Google Drive abgelegt.
      </p>
    );
  return (
    <div>
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await api(`/api/invoice-documents/${id}/drive`);
            setDone(true);
            onUploaded?.();
            router.refresh();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Drive-Ablage fehlgeschlagen.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Wird abgelegt …" : "In Drive ablegen / erneut versuchen"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
export function InvoiceComposer({
  events,
  canWrite,
  defaultSender,
}: {
  events: { id: string; name: string; mapped: boolean }[];
  canWrite: boolean;
  defaultSender: InvoiceSender;
}) {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState([initialItem()]);
  const [destination, setDestination] = useState("DJ_2026");
  const [payment, setPayment] = useState("TRANSFER_OPEN");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "create" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string; drive: boolean } | null>(
    null,
  );
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!preview) return;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      URL.revokeObjectURL(preview);
    };
  }, [preview]);
  function readInput(): InvoiceInput | null {
    const form = formRef.current;
    if (!form?.reportValidity()) return null;
    const values = new FormData(form);
    requestId.current ??= crypto.randomUUID();
    return {
      sender: Object.fromEntries(
        Object.keys(defaultSender).map((key) => [
          key,
          String(values.get(`sender.${key}`) ?? ""),
        ]),
      ) as InvoiceSender,
      requestId: requestId.current,
      recipient: String(values.get("recipient") ?? ""),
      title: String(values.get("title") ?? ""),
      serviceDate: String(values.get("serviceDate") ?? ""),
      payment: payment as InvoiceInput["payment"],
      paidAt: String(values.get("paidAt") ?? ""),
      dueDays: Number(values.get("dueDays") ?? 14),
      destination: destination as InvoiceInput["destination"],
      eventId: String(values.get("eventId") ?? ""),
      items,
      confirmed: true,
    };
  }
  async function submit(mode: "preview" | "create") {
    const input = readInput();
    if (!input || (mode === "create" && !confirmed)) return;
    setBusy(mode);
    setError("");
    setSuccess(null);
    try {
      if (mode === "preview") {
        const response = await api("/api/invoice-documents/preview", input);
        setPreview(URL.createObjectURL(await response.blob()));
      } else {
        const response = await api("/api/invoice-documents", input);
        const { id } = (await response.json()) as { id: string };
        setSuccess({ id, drive: false });
        // Creation and Drive delivery are independent. A delivery failure must
        // never consume another invoice number or lose the generated PDF.
        try {
          await api(`/api/invoice-documents/${id}/drive`);
          setSuccess({ id, drive: true });
        } catch (error) {
          setError(
            `Rechnung ist gespeichert. ${error instanceof Error ? error.message : "Drive-Ablage bitte erneut versuchen."}`,
          );
        }
        router.refresh();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Erstellung fehlgeschlagen.",
      );
    } finally {
      setBusy(null);
    }
  }
  const changeItem = (index: number, update: Partial<(typeof items)[number]>) =>
    setItems((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...update } : row)),
    );
  const total = items.every(
    (item) =>
      /^\d{1,7}(?:[.,]\d{1,2})?$/.test(item.unitPrice) &&
      Number.isInteger(item.quantity),
  )
    ? euro(totalCents(items))
    : "—";
  return (
    <>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          void submit("create");
        }}
        className="space-y-7"
      >
        <fieldset
          disabled={!!busy || !!success}
          className="space-y-7 disabled:opacity-75"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <section className="bg-card space-y-4 rounded-xl border p-5">
              <h2 className="text-lg font-semibold">Empfänger & Leistung</h2>
              <label className="block text-sm">
                Rechnungsempfänger und vollständige Anschrift
                <textarea
                  name="recipient"
                  rows={5}
                  required
                  maxLength={500}
                  placeholder={
                    "Firma / Name\nAnsprechpartner\nStraße und Hausnummer\nPLZ Ort"
                  }
                  className={field}
                />
              </label>
              <label className="block text-sm">
                Bezeichnung / Veranstaltung
                <input
                  name="title"
                  required
                  maxLength={150}
                  placeholder="z. B. Rave the Mountain Festival"
                  className={field}
                />
              </label>
              <label className="block text-sm">
                Leistungsdatum
                <input
                  type="date"
                  name="serviceDate"
                  required
                  className={field}
                />
              </label>
              <p className="text-muted-foreground text-xs">
                Rechnungsdatum und Monatsnummer werden bei der Erstellung
                automatisch in deutscher Ortszeit vergeben.
              </p>
            </section>
            <section className="bg-card space-y-4 rounded-xl border p-5">
              <h2 className="text-lg font-semibold">Zahlung & Ablage</h2>
              <label className="block text-sm">
                Zahlung
                <select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  className={field}
                >
                  <option value="TRANSFER_OPEN">
                    Überweisung – noch offen
                  </option>
                  <option value="TRANSFER_PAID">
                    Überweisung – bereits erhalten
                  </option>
                  <option value="CASH_PAID">Bar – bereits erhalten</option>
                </select>
              </label>
              {payment === "TRANSFER_OPEN" ? (
                <label className="block text-sm">
                  Zahlungsziel in Tagen
                  <input
                    name="dueDays"
                    type="number"
                    min={1}
                    max={90}
                    defaultValue={14}
                    required
                    className={field}
                  />
                </label>
              ) : (
                <label className="block text-sm">
                  Zahlung erhalten am
                  <input name="paidAt" type="date" required className={field} />
                </label>
              )}
              <label className="block text-sm">
                PDF speichern unter
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className={field}
                >
                  <option value="DJ_2026">DJ Gigs · Rechnungen 2026</option>
                  <option value="EVENT">Event · Einnahmerechnungen</option>
                </select>
              </label>
              {destination === "EVENT" ? (
                <label className="block text-sm">
                  Event
                  <select
                    name="eventId"
                    required
                    className={field}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Event auswählen
                    </option>
                    {events.map((event) => (
                      <option
                        key={event.id}
                        value={event.id}
                        disabled={!event.mapped}
                      >
                        {event.name}
                        {event.mapped ? "" : " – Einnahmenordner fehlt"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <a
                  className="text-primary inline-block text-sm underline"
                  href="https://drive.google.com/drive/folders/18xlDM6tllxVCaI46ALs44E4edS4iJbis"
                  target="_blank"
                  rel="noreferrer"
                >
                  DJ-Gig-Zielordner in Drive öffnen ↗
                </a>
              )}
              <p className="text-muted-foreground text-xs">
                Rechnungen buchen keine Einnahmen automatisch. Event-Rechnungen
                kannst du anschließend bei Finanzen einer Buchung zuordnen.
              </p>
            </section>
          </div>
          <section className="bg-card space-y-5 rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Leistungspositionen</h2>
            {items.map((item, index) => (
              <div
                className="grid items-start gap-3 border-b pb-5 md:grid-cols-[1fr_110px_150px_auto]"
                key={index}
              >
                <label className="text-sm">
                  {index + 1}. Beschreibung
                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      changeItem(index, { description: e.target.value })
                    }
                    rows={3}
                    maxLength={1500}
                    required
                    placeholder="Gage für DJ-Tätigkeit am … auf dem …"
                    className={field}
                  />
                </label>
                <label className="text-sm">
                  Anzahl
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    required
                    value={item.quantity}
                    onChange={(e) =>
                      changeItem(index, { quantity: Number(e.target.value) })
                    }
                    className={field}
                  />
                </label>
                <label className="text-sm">
                  Einzelpreis in EUR
                  <input
                    inputMode="decimal"
                    pattern="[0-9]{1,7}([.,][0-9]{1,2})?"
                    required
                    value={item.unitPrice}
                    onChange={(e) =>
                      changeItem(index, { unitPrice: e.target.value })
                    }
                    placeholder="500,00"
                    className={field}
                  />
                </label>
                <Button
                  variant="ghost"
                  type="button"
                  aria-label={`Position ${index + 1} entfernen`}
                  disabled={items.length === 1}
                  className="mt-5"
                  onClick={() =>
                    setItems((rows) => rows.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              type="button"
              disabled={items.length >= 30}
              onClick={() => setItems((rows) => [...rows, initialItem()])}
            >
              <Plus className="size-4" />
              Position hinzufügen
            </Button>
            <p className="text-right text-lg font-semibold" aria-live="polite">
              Gesamtbetrag: {total}
            </p>
          </section>
          <section className="bg-card space-y-3 rounded-xl border p-5">
            <h2 className="font-semibold">Absender: LIGHTSIGNAL GBR</h2>
            <SenderFields defaults={defaultSender} />
            <p className="text-muted-foreground text-sm">
              Absender-, Kontakt-, Steuer- und Bankangaben sind vorausgefüllt
              und für diese Rechnung änderbar. Logo und Hinweis nach §19 UStG
              bleiben erhalten. Die Angaben werden mit der fertigen Rechnung
              gespeichert.
            </p>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              Ich habe Empfänger, Leistungen, Beträge, Zahlung und die
              Absenderangaben in der Vorschau geprüft. Die Rechnung soll
              verbindlich erstellt werden.
            </label>
          </section>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void submit("preview")}
              disabled={!!busy}
            >
              <FileSearch className="size-4" />
              {busy === "preview" ? "Vorschau wird erstellt …" : "PDF-Vorschau"}
            </Button>
            <Button type="submit" disabled={!canWrite || !confirmed || !!busy}>
              <FilePlus2 className="size-4" />
              {busy === "create"
                ? "Erstellen & in Drive ablegen …"
                : "Rechnung erstellen & ablegen"}
            </Button>
          </div>
        </fieldset>
        {error && (
          <p
            role="alert"
            className="text-destructive bg-destructive/10 rounded-xl border p-4 text-sm"
          >
            {error}
          </p>
        )}
        {success && (
          <div
            role="status"
            className="bg-success/10 space-y-3 rounded-xl border p-5"
          >
            <p>
              Rechnung erstellt.
              {success.drive
                ? " Die PDF wurde in Drive abgelegt."
                : " Die PDF ist sicher gespeichert; die Drive-Ablage kann erneut gestartet werden."}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                className="text-primary underline"
                target="_blank"
                rel="noreferrer"
                href={`/api/invoice-documents/${success.id}/pdf`}
              >
                PDF öffnen
              </a>
              <a
                className="text-primary underline"
                href={`/api/invoice-documents/${success.id}/pdf?download=1`}
              >
                Herunterladen
              </a>
            </div>
            {!success.drive && (
              <DriveRetry
                id={success.id}
                onUploaded={() => setSuccess({ id: success.id, drive: true })}
              />
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                formRef.current?.reset();
                requestId.current = null;
                setItems([initialItem()]);
                setConfirmed(false);
                setError("");
                setSuccess(null);
              }}
            >
              Weitere Rechnung erstellen
            </Button>
          </div>
        )}
      </form>
      <dialog
        ref={dialog}
        onClose={() => setPreview(null)}
        className="bg-card text-foreground m-auto h-[90dvh] w-[96vw] max-w-5xl rounded-xl border p-0 backdrop:bg-black/75"
      >
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <h2 className="font-semibold">
            PDF-Vorschau · keine Nummer vergeben
          </h2>
          <Button variant="outline" onClick={() => dialog.current?.close()}>
            Schließen
          </Button>
        </div>
        {preview && (
          <iframe
            title="Rechnungsvorschau"
            src={preview}
            className="h-[calc(100%-80px)] min-h-[65vh] w-full bg-white"
          />
        )}
      </dialog>
    </>
  );
}
