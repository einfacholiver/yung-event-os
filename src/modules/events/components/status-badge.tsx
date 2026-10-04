import { statusLabels } from "../config";

const styles = {
  DRAFT: "bg-stone-100 text-stone-700",
  PLANNED: "bg-blue-50 text-blue-800",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  COMPLETED: "bg-violet-50 text-violet-800",
  CANCELLED: "bg-red-50 text-red-800",
};
export function StatusBadge({ status }: { status: keyof typeof statusLabels }) {
  return (
    <span
      className={
        "inline-flex rounded-full px-3 py-1 text-xs font-medium " +
        styles[status]
      }
    >
      {statusLabels[status]}
    </span>
  );
}
