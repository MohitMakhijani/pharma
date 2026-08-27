CREATE TYPE "InventoryAuditStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

CREATE TABLE "InventoryAudit" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'all',
    "status" "InventoryAuditStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryAudit_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InventoryAuditItem" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "expectedQty" DECIMAL(14,3) NOT NULL,
    "countedQty" DECIMAL(14,3),
    "variance" DECIMAL(14,3),
    CONSTRAINT "InventoryAuditItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InventoryAudit_storeId_idx" ON "InventoryAudit"("storeId");
CREATE INDEX "InventoryAudit_auditDate_idx" ON "InventoryAudit"("auditDate");
CREATE INDEX "InventoryAudit_status_idx" ON "InventoryAudit"("status");
CREATE UNIQUE INDEX "InventoryAuditItem_auditId_batchId_key" ON "InventoryAuditItem"("auditId", "batchId");
CREATE INDEX "InventoryAuditItem_productId_idx" ON "InventoryAuditItem"("productId");
CREATE INDEX "InventoryAuditItem_batchId_idx" ON "InventoryAuditItem"("batchId");
ALTER TABLE "InventoryAudit" ADD CONSTRAINT "InventoryAudit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAuditItem" ADD CONSTRAINT "InventoryAuditItem_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InventoryAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAuditItem" ADD CONSTRAINT "InventoryAuditItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON UPDATE CASCADE;
ALTER TABLE "InventoryAuditItem" ADD CONSTRAINT "InventoryAuditItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON UPDATE CASCADE;