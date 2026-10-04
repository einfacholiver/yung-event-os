export const eventTabs = [
  { slug: "overview", label: "Overview" },
  { slug: "finances", label: "Finances" },
  { slug: "invoices", label: "Invoices" },
  { slug: "documents", label: "Documents" },
  { slug: "tasks", label: "Tasks" },
  { slug: "media", label: "Media" },
  { slug: "permissions", label: "Permissions" },
  { slug: "tickets", label: "Tickets" },
  { slug: "analytics", label: "Analytics" },
] as const;

export const statusLabels = {
  DRAFT: "Entwurf",
  PLANNED: "Geplant",
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgesagt",
} as const;

export function formatEventDate(date: Date | null, timezone: string) {
  if (!date) return "Noch nicht festgelegt";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}
