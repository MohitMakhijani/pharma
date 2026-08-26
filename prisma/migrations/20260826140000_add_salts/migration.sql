CREATE TABLE "Salt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Salt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductSalt" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "saltId" TEXT NOT NULL,
    CONSTRAINT "ProductSalt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Salt_name_key" ON "Salt"("name");
CREATE UNIQUE INDEX "ProductSalt_productId_saltId_key" ON "ProductSalt"("productId", "saltId");
CREATE INDEX "ProductSalt_productId_idx" ON "ProductSalt"("productId");
CREATE INDEX "ProductSalt_saltId_idx" ON "ProductSalt"("saltId");

ALTER TABLE "ProductSalt" ADD CONSTRAINT "ProductSalt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductSalt" ADD CONSTRAINT "ProductSalt_saltId_fkey" FOREIGN KEY ("saltId") REFERENCES "Salt"("id") ON DELETE CASCADE ON UPDATE CASCADE;