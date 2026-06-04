-- CreateEnum
CREATE TYPE "ExpiryCategory" AS ENUM ('K8S_CERTIFICATE', 'TLS_CERTIFICATE', 'LICENSE', 'WARRANTY', 'DOMAIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExpiryStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RENEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ExpiryTracker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ExpiryCategory" NOT NULL,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "notifyDays" INTEGER NOT NULL DEFAULT 30,
    "status" "ExpiryStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpiryTracker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpiryTracker_expiresAt_idx" ON "ExpiryTracker"("expiresAt");

-- CreateIndex
CREATE INDEX "ExpiryTracker_category_idx" ON "ExpiryTracker"("category");
