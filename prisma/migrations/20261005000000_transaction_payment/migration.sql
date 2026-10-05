ALTER TABLE "Transaction" ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN "paidBy" TEXT;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payment_check" CHECK (
  ("isPaid" OR "paidBy" IS NULL) AND ("paidBy" IS NULL OR (length(trim("paidBy")) BETWEEN 1 AND 100))
);
