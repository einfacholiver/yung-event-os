import { statusLabels } from "../config";

const styles = {
  DRAFT: "status-warning",
  PLANNED: "status-info",
  ACTIVE: "status-success",
  COMPLETED: "status-success",
  CANCELLED: "status-error",
};
export function StatusBadge({ status }: { status: keyof typeof statusLabels }) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium " +
        styles[status]
      }
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${status === "DRAFT" ? "bg-warning" : status === "PLANNED" ? "bg-info" : status === "CANCELLED" ? "bg-destructive" : "bg-success"}`}
      />
      {statusLabels[status]}
    </span>
  );
}
