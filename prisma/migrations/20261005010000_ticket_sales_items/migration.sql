CREATE TABLE "TicketSalesItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "grossRevenue" DECIMAL(14,2) NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketSalesItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketSalesItem_values_check" CHECK (
    "quantity" >= 0 AND "unitPrice" >= 0 AND "grossRevenue" = "quantity" * "unitPrice"
    AND "category" IN ('TICKET', 'UPGRADE')
  )
);
CREATE UNIQUE INDEX "TicketSalesItem_eventId_description_key" ON "TicketSalesItem"("eventId", "description");
CREATE INDEX "TicketSalesItem_organizationId_eventId_idx" ON "TicketSalesItem"("organizationId", "eventId");
ALTER TABLE "TicketSalesItem" ADD CONSTRAINT "TicketSalesItem_organizationId_eventId_fkey" FOREIGN KEY ("organizationId", "eventId") REFERENCES "Event"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
