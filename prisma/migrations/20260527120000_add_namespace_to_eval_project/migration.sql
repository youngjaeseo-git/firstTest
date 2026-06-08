-- AlterTable
ALTER TABLE "EvalProject" ADD COLUMN IF NOT EXISTS "namespace" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvalProject_namespace_idx" ON "EvalProject"("namespace");
