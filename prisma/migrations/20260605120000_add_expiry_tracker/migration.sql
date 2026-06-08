-- CreateEnum
DO $$ BEGIN CREATE TYPE "ExpiryCategory" AS ENUM ('K8S_CERTIFICATE', 'TLS_CERTIFICATE', 'LICENSE', 'WARRANTY', 'DOMAIN', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ExpiryStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RENEWED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ExpiryTracker" (
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
CREATE INDEX IF NOT EXISTS "ExpiryTracker_expiresAt_idx" ON "ExpiryTracker"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExpiryTracker_category_idx" ON "ExpiryTracker"("category");
