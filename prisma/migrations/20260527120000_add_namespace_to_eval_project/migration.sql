-- AlterTable
ALTER TABLE "EvalProject" ADD COLUMN "namespace" TEXT;

-- CreateIndex
CREATE INDEX "EvalProject_namespace_idx" ON "EvalProject"("namespace");
