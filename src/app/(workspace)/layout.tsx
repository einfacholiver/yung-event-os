import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { requireAdminPage } from "@/server/auth/access";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return (
    <>
      <WorkspaceNavigation />
      {children}
    </>
  );
}
