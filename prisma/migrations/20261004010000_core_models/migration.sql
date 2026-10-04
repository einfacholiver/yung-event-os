BEGIN;

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DriveConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "DriveItemKind" AS ENUM ('FILE', 'FOLDER');

-- CreateEnum
CREATE TYPE "DriveFolderPurpose" AS ENUM ('ROOT', 'FINANCE', 'PRODUCTION', 'MARKETING');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "InvoiceDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PermissionResource" AS ENUM ('ORGANIZATION', 'USER', 'EVENT', 'DRIVE', 'TRANSACTION', 'INVOICE', 'TASK', 'PERMISSION', 'ACTIVITY_LOG');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('READ', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "status" "DriveConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "credentialReference" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "parentExternalId" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" "DriveItemKind" NOT NULL,
    "webViewUrl" TEXT,
    "modifiedAt" TIMESTAMP(3),
    "trashed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveFolderMapping" (
    "driveItemKind" "DriveItemKind" NOT NULL DEFAULT 'FOLDER',
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "driveItemId" TEXT NOT NULL,
    "purpose" "DriveFolderPurpose" NOT NULL DEFAULT 'ROOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveFolderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "invoiceId" TEXT,
    "direction" "TransactionDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "driveItemId" TEXT,
    "number" TEXT,
    "counterparty" TEXT NOT NULL,
    "direction" "InvoiceDirection" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "resource" "PermissionResource" NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Event_organizationId_status_idx" ON "Event"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Event_organizationId_id_key" ON "Event"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Event_organizationId_slug_key" ON "Event"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "DriveConnection_organizationId_id_key" ON "DriveConnection"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DriveConnection_organizationId_accountEmail_key" ON "DriveConnection"("organizationId", "accountEmail");

-- CreateIndex
CREATE INDEX "DriveItem_organizationId_connectionId_parentExternalId_idx" ON "DriveItem"("organizationId", "connectionId", "parentExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveItem_organizationId_id_key" ON "DriveItem"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DriveItem_organizationId_id_kind_key" ON "DriveItem"("organizationId", "id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "DriveItem_connectionId_externalId_key" ON "DriveItem"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "DriveFolderMapping_organizationId_driveItemId_idx" ON "DriveFolderMapping"("organizationId", "driveItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveFolderMapping_eventId_purpose_key" ON "DriveFolderMapping"("eventId", "purpose");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_bookedAt_idx" ON "Transaction"("organizationId", "bookedAt");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_eventId_idx" ON "Transaction"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_invoiceId_idx" ON "Transaction"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_eventId_idx" ON "Invoice"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_driveItemId_idx" ON "Invoice"("organizationId", "driveItemId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_status_dueAt_idx" ON "Invoice"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_id_key" ON "Invoice"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Task_organizationId_eventId_idx" ON "Task"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "Task_organizationId_assigneeId_idx" ON "Task"("organizationId", "assigneeId");

-- CreateIndex
CREATE INDEX "Task_organizationId_status_dueAt_idx" ON "Task"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Permission_organizationId_userId_idx" ON "Permission"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Permission_organizationId_eventId_idx" ON "Permission"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_createdAt_idx" ON "ActivityLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_eventId_idx" ON "ActivityLog"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_actorId_idx" ON "ActivityLog"("organizationId", "actorId");

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_entityType_entityId_idx" ON "ActivityLog"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_id_key" ON "User"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveConnection" ADD CONSTRAINT "DriveConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveItem" ADD CONSTRAINT "DriveItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveItem" ADD CONSTRAINT "DriveItem_organizationId_connectionId_fkey" FOREIGN KEY ("organizationId", "connectionId") REFERENCES "DriveConnection"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveFolderMapping" ADD CONSTRAINT "DriveFolderMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveFolderMapping" ADD CONSTRAINT "DriveFolderMapping_organizationId_eventId_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "Event"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveFolderMapping" ADD CONSTRAINT "DriveFolderMapping_organizationId_driveItemId_driveItemKin_fkey" FOREIGN KEY ("organizationId", "driveItemId", "driveItemKind") REFERENCES "DriveItem"("organizationId", "id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_eventId_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "Event"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_invoiceId_fkey" FOREIGN KEY ("organizationId", "invoiceId") REFERENCES "Invoice"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_eventId_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "Event"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_driveItemId_fkey" FOREIGN KEY ("organizationId", "driveItemId") REFERENCES "DriveItem"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_eventId_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "Event"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_assigneeId_fkey" FOREIGN KEY ("organizationId", "assigneeId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "User"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_organizationId_eventId_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "Event"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_eventId_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "Event"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_actorId_fkey" FOREIGN KEY ("organizationId", "actorId") REFERENCES "User"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants not expressible as Prisma schema attributes.
ALTER TABLE "Event" ADD CONSTRAINT "Event_date_order_check"
  CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" >= "startsAt");
ALTER TABLE "DriveConnection" ADD CONSTRAINT "DriveConnection_allowed_account_check"
  CHECK ("accountEmail" = 'lightsignal.dj@gmail.com');
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_check" CHECK ("amount" > 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amount_check" CHECK ("totalAmount" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_date_order_check"
  CHECK ("issuedAt" IS NULL OR "dueAt" IS NULL OR "dueAt" >= "issuedAt");

-- Nullable event scope must not allow duplicate organization-wide grants.
CREATE UNIQUE INDEX "Permission_organization_grant_key"
  ON "Permission" ("organizationId", "userId", "resource", "action") WHERE "eventId" IS NULL;
CREATE UNIQUE INDEX "Permission_event_grant_key"
  ON "Permission" ("organizationId", "userId", "eventId", "resource", "action") WHERE "eventId" IS NOT NULL;

ALTER TABLE "DriveFolderMapping" ADD CONSTRAINT "DriveFolderMapping_folder_kind_check" CHECK ("driveItemKind" = 'FOLDER');

COMMIT;
