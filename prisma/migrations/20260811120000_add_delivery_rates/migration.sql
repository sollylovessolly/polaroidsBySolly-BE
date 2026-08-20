CREATE TABLE "DeliveryRate" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "normalizedState" TEXT NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryRate_normalizedState_key"
ON "DeliveryRate"("normalizedState");
