CREATE TABLE "InvoiceCounter" (
    "organizationId" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "lastSequence" INTEGER NOT NULL,
    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("organizationId", "period"),
    CONSTRAINT "InvoiceCounter_sequence_check" CHECK ("lastSequence" > 0),
    CONSTRAINT "InvoiceCounter_period_check" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE TABLE "InvoiceDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "pdf" BYTEA NOT NULL,
    "fileName" TEXT NOT NULL,
    "parentExternalId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvoiceDocument_sequence_check" CHECK ("sequence" > 0)
);
CREATE UNIQUE INDEX "InvoiceDocument_invoiceId_key" ON "InvoiceDocument"("invoiceId");
CREATE UNIQUE INDEX "InvoiceDocument_organizationId_requestId_key" ON "InvoiceDocument"("organizationId", "requestId");
CREATE UNIQUE INDEX "InvoiceDocument_organizationId_invoiceId_key" ON "InvoiceDocument"("organizationId", "invoiceId");
CREATE UNIQUE INDEX "InvoiceDocument_organizationId_number_key" ON "InvoiceDocument"("organizationId", "number");
CREATE UNIQUE INDEX "InvoiceDocument_organizationId_period_sequence_key" ON "InvoiceDocument"("organizationId", "period", "sequence");
CREATE INDEX "InvoiceDocument_organizationId_createdAt_idx" ON "InvoiceDocument"("organizationId", "createdAt");
ALTER TABLE "InvoiceCounter" ADD CONSTRAINT "InvoiceCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_organizationId_invoiceId_fkey" FOREIGN KEY ("organizationId", "invoiceId") REFERENCES "Invoice"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
