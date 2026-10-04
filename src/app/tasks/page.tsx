import Link from "next/link";
import { getDb } from "@/server/db/client";
import { requireDriveUser } from "@/modules/drive/server/context";
import { InlineEdit } from "@/modules/workspace/components/inline-edit";
export const dynamic = "force-dynamic";
export default async function TasksPage() {
  let tasks: Awaited<ReturnType<typeof load>> = [];
  let events: { id: string; name: string }[] = [];
  try {
    tasks = await load();
    const { organizationId } = await requireDriveUser();
    events = await getDb().event.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return (
      <main className="p-10">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="mt-3">Bitte anmelden und Google Drive verbinden.</p>
      </main>
    );
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <nav className="flex gap-4 text-sm">
          <Link href="/events">Events</Link>
          <Link href="/finances">Finanzen</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        <h1 className="text-4xl font-semibold">Tasks</h1>
        <section className="bg-card rounded-xl border">
          <div className="border-b p-5">
            <h2 className="text-xl font-semibold">Task anlegen</h2>
            <InlineEdit
              type="task"
              events={events}
              initial={{ title: "", status: "TODO", priority: "MEDIUM" }}
            />
          </div>
          <ul className="divide-y">
            {tasks.length ? (
              tasks.map((task) => (
                <li key={task.id} className="p-5">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {task.event?.name ?? "Organisation"} · {task.status} ·
                    Priorität {task.priority}
                  </p>
                  <InlineEdit
                    type="task"
                    id={task.id}
                    initial={{
                      title: task.title,
                      status: task.status,
                      priority: task.priority,
                    }}
                  />
                </li>
              ))
            ) : (
              <li className="text-muted-foreground p-8 text-center">
                Noch keine Tasks angelegt.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
async function load() {
  const { organizationId } = await requireDriveUser();
  return getDb().task.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      event: { select: { name: true } },
    },
  });
}
