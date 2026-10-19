import type { InvoiceSender } from "./schema";

const field =
  "bg-background border-input mt-1 w-full rounded-lg border px-3 py-2.5 text-sm";
export function SenderFields({ defaults }: { defaults: InvoiceSender }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["brand", "Absender / Firmenname", 40],
            ["owners", "Inhaber / vollständiger Firmenname", 100],
            ["street", "Absender: Straße und Hausnummer", 80],
            ["postalCity", "Absender: PLZ und Ort", 80],
            ["phone", "Absender: Telefon", 40],
            ["email", "Absender: E-Mail", 100],
            ["taxNumber", "Steuernummer", 40],
          ] as const
        ).map(([key, label, max]) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              name={`sender.${key}`}
              defaultValue={defaults[key]}
              required
              maxLength={max}
              type={key === "email" ? "email" : "text"}
              className={field}
            />
          </label>
        ))}
      </div>
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">
          Bankdaten bearbeiten
        </summary>
        <p className="text-muted-foreground mt-2 text-xs">
          Die bisherige Bankverbindung bleibt vorausgefüllt. Änderungen gelten
          für diese Rechnung.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(
            [
              ["bankName", "Bankname", 60],
              ["iban", "IBAN", 80],
              ["bic", "BIC", 11],
            ] as const
          ).map(([key, label, max]) => (
            <label key={key} className="block text-sm">
              {label}
              <input
                name={`sender.${key}`}
                defaultValue={defaults[key]}
                required
                maxLength={max}
                spellCheck={false}
                className={field}
              />
            </label>
          ))}
        </div>
      </details>
    </>
  );
}
