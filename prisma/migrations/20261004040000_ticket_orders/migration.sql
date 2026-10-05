CREATE TABLE "TicketOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "paymentStatus" TEXT NOT NULL,
  "cancelled" BOOLEAN NOT NULL,
  "tickets" INTEGER,
  "tables" INTEGER,
  "lounges" INTEGER,
  "total" DECIMAL(14,2) NOT NULL,
  "refunded" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketOrder_organizationId_eventId_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "Event"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketOrder_amount_check" CHECK ("total" >= 0 AND "refunded" >= 0 AND "refunded" <= "total"),
  CONSTRAINT "TicketOrder_quantity_check" CHECK (("tickets" IS NULL OR "tickets" >= 0) AND ("tables" IS NULL OR "tables" >= 0) AND ("lounges" IS NULL OR "lounges" >= 0))
);
CREATE UNIQUE INDEX "TicketOrder_eventId_orderNumber_key" ON "TicketOrder"("eventId", "orderNumber");
CREATE INDEX "TicketOrder_organizationId_eventId_idx" ON "TicketOrder"("organizationId", "eventId");
