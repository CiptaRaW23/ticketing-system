-- CreateTable
CREATE TABLE "customer_registry" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "address" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedByUserId" INTEGER,
    "note" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "customer_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_registry_phone_key" ON "customer_registry"("phone");

-- CreateIndex
CREATE INDEX "customer_registry_phone_idx" ON "customer_registry"("phone");

-- CreateIndex
CREATE INDEX "customer_registry_isUsed_idx" ON "customer_registry"("isUsed");

-- CreateIndex
CREATE INDEX "customer_registry_importedAt_idx" ON "customer_registry"("importedAt");
