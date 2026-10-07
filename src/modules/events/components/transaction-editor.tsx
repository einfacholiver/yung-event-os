"use client";

import { useEffect, useId, useRef } from "react";
import { ApiForm } from "@/modules/workspace/components/api-form";
import { FinanceFields } from "./finance-fields";
import { DeleteTransaction } from "./delete-transaction";

export function TransactionEditor({
  row,
  onClose,
  onDeleted,
}: {
  row: {
    id: string;
    direction: string;
    amount: string;
    bookedAt: string;
    description: string | null;
    isPaid: boolean;
    paidBy: string | null;
  };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="bg-card text-foreground m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border p-5 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:p-6"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-semibold">
            Buchung bearbeiten
          </h2>
          <p className="text-muted-foreground mt-1 text-sm break-words">
            {row.description || "Buchung ohne Beschreibung"}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border px-3 py-2 text-sm"
          onClick={() => dialog.current?.close()}
        >
          Schließen
        </button>
      </header>
      <ApiForm
        method="PATCH"
        reset={false}
        endpoint={`/api/finances/transactions/${row.id}`}
        className="grid min-w-0 gap-4 sm:grid-cols-2"
      >
        <FinanceFields row={row} />
      </ApiForm>
      <div className="mt-5">
        <DeleteTransaction
          id={row.id}
          description={row.description}
          amount={row.amount}
          onDeleted={() => {
            onDeleted();
            dialog.current?.close();
          }}
        />
      </div>
    </dialog>
  );
}
