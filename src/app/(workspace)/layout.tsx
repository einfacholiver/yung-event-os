import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { requireAdminPage } from "@/server/auth/access";
import { DriveSyncProvider } from "@/modules/drive/components/drive-sync-provider";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return (
    <DriveSyncProvider>
      <WorkspaceNavigation />
      {children}
    </DriveSyncProvider>
  );
}
