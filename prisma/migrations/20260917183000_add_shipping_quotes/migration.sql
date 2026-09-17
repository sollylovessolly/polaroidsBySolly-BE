CREATE TABLE "ShippingQuote" (
    "id" TEXT NOT NULL,
    "requestToken" TEXT NOT NULL,
    "checkoutHash" TEXT NOT NULL,
    "courierChoices" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShippingQuote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShippingQuote_requestToken_key" ON "ShippingQuote"("requestToken");
