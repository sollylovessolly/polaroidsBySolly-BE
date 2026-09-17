ALTER TABLE "Payment"
ADD COLUMN "reconciliationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reconciliationReason" TEXT;
