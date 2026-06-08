-- CreateEnum
DO $$ BEGIN CREATE TYPE "EvalType" AS ENUM ('FIELD', 'ACCELERATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "EvalProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "EvalPhaseStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "EvalTestResult" AS ENUM ('PASS', 'FAIL', 'WARNING', 'RUNNING', 'PENDING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "EvalTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "EvalTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EvalProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evalType" "EvalType" NOT NULL,
    "status" "EvalProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "memoryType" "MemoryType",
    "manufacturer" TEXT,
    "partNumber" TEXT,
    "capacityGb" DOUBLE PRECISION,
    "speedMhz" INTEGER,
    "formFactor" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvalProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EvalPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "EvalPhaseStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "description" TEXT,

    CONSTRAINT "EvalPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EvalResult" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "equipmentId" TEXT,
    "workloadName" TEXT NOT NULL,
    "workloadConfig" TEXT,
    "cycleDuration" TEXT,
    "totalCycles" INTEGER,
    "completedCycles" INTEGER,
    "result" "EvalTestResult" NOT NULL,
    "value" TEXT,
    "unit" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "testedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EvalTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "EvalTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "EvalTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EvalNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvalProject_status_idx" ON "EvalProject"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvalProject_evalType_idx" ON "EvalProject"("evalType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvalPhase_projectId_idx" ON "EvalPhase"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvalResult_projectId_idx" ON "EvalResult"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvalResult_equipmentId_idx" ON "EvalResult"("equipmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvalTask_projectId_idx" ON "EvalTask"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvalTask_status_idx" ON "EvalTask"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvalNote_projectId_idx" ON "EvalNote"("projectId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
ALTER TABLE "EvalPhase" ADD CONSTRAINT "EvalPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EvalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "EvalResult" ADD CONSTRAINT "EvalResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EvalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "EvalResult" ADD CONSTRAINT "EvalResult_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "EvalPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "EvalResult" ADD CONSTRAINT "EvalResult_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "EvalTask" ADD CONSTRAINT "EvalTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EvalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "EvalTask" ADD CONSTRAINT "EvalTask_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "EvalPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "EvalNote" ADD CONSTRAINT "EvalNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EvalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
