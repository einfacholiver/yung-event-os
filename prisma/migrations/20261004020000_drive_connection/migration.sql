BEGIN;
ALTER TABLE "DriveConnection"
  ADD COLUMN "googleAccountId" TEXT,
  ADD COLUMN "rootFolderId" TEXT,
  ADD COLUMN "rootFolderName" TEXT,
  ADD COLUMN "folderSelectedAt" TIMESTAMP(3);
CREATE INDEX "DriveConnection_googleAccountId_idx" ON "DriveConnection"("googleAccountId");
ALTER TABLE "DriveConnection" ADD CONSTRAINT "DriveConnection_googleAccountId_fkey"
  FOREIGN KEY ("googleAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriveConnection" ADD CONSTRAINT "DriveConnection_root_selection_check"
  CHECK (("rootFolderId" IS NULL AND "rootFolderName" IS NULL AND "folderSelectedAt" IS NULL)
      OR ("rootFolderId" IS NOT NULL AND length("rootFolderId") > 0 AND "rootFolderName" IS NOT NULL AND "folderSelectedAt" IS NOT NULL));
COMMIT;
