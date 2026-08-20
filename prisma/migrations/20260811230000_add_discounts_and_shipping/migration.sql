CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

CREATE TABLE "DiscountCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "DiscountType" NOT NULL,
  "value" DECIMAL(12,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "minimumOrderAmount" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

ALTER TABLE "Order"
ADD COLUMN "discountCode" TEXT,
ADD COLUMN "shipmentRequestToken" TEXT,
ADD COLUMN "shipmentServiceCode" TEXT,
ADD COLUMN "shipmentCourierId" TEXT,
ADD COLUMN "shipmentReference" TEXT,
ADD COLUMN "shipmentStatus" TEXT,
ADD COLUMN "shipmentError" TEXT,
ADD COLUMN "shipmentAttemptedAt" TIMESTAMP(3),
ADD COLUMN "shipmentCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_shipmentReference_key" ON "Order"("shipmentReference");
