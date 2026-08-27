CREATE TABLE "CustomerLedgerShare" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerLedgerShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerLedgerShare_token_key" ON "CustomerLedgerShare"("token");
CREATE INDEX "CustomerLedgerShare_customerId_idx" ON "CustomerLedgerShare"("customerId");
CREATE INDEX "CustomerLedgerShare_storeId_idx" ON "CustomerLedgerShare"("storeId");

ALTER TABLE "CustomerLedgerShare" ADD CONSTRAINT "CustomerLedgerShare_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerLedgerShare" ADD CONSTRAINT "CustomerLedgerShare_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
