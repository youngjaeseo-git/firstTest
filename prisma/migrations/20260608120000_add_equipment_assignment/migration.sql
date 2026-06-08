-- CreateTable
CREATE TABLE IF NOT EXISTS "EquipmentAssignment" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL,
    "purpose" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EquipmentAssignment_equipmentId_idx" ON "EquipmentAssignment"("equipmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EquipmentAssignment_assignedTo_idx" ON "EquipmentAssignment"("assignedTo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EquipmentAssignment_releasedAt_idx" ON "EquipmentAssignment"("releasedAt");

-- AddForeignKey
DO $$ BEGIN
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
