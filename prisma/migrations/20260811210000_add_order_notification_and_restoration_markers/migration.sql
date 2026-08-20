ALTER TABLE "Order"
ADD COLUMN "inventoryRestoredAt" TIMESTAMP(3),
ADD COLUMN "ownerNotifiedAt" TIMESTAMP(3),
ADD COLUMN "customerEmailSentAt" TIMESTAMP(3);
