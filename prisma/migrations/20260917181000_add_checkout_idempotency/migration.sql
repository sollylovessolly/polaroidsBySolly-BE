ALTER TABLE "Order"
ADD COLUMN "checkoutKey" TEXT,
ADD COLUMN "checkoutToken" TEXT;

CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");
CREATE UNIQUE INDEX "Order_checkoutToken_key" ON "Order"("checkoutToken");
