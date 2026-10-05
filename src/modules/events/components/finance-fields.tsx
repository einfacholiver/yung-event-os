export function FinanceFields({
  row,
}: {
  row?: {
    direction: string;
    amount: string;
    bookedAt: string;
    description: string | null;
  };
}) {
  const style = "block w-full rounded border bg-white p-2";
  return (
    <>
      <label>
        Datum
        <input
          className={style}
          required
          type="date"
          name="bookedAt"
          defaultValue={row?.bookedAt}
        />
      </label>
      <label>
        Art
        <select
          className={style}
          name="direction"
          defaultValue={row?.direction ?? "EXPENSE"}
        >
          <option value="EXPENSE">Ausgabe</option>
          <option value="INCOME">Einnahme</option>
        </select>
      </label>
      <label>
        Beschreibung
        <input
          className={style}
          name="description"
          maxLength={500}
          defaultValue={row?.description ?? ""}
        />
      </label>
      <label>
        Betrag in EUR
        <input
          className={style}
          required
          inputMode="decimal"
          name="amount"
          placeholder="0,00"
          defaultValue={row?.amount}
        />
      </label>
      <button className="self-end rounded bg-stone-900 px-4 py-2 text-white">
        Speichern
      </button>
    </>
  );
}
