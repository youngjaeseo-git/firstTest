-- CreateTable: RoomElement (infrastructure elements on floor plan)
CREATE TABLE IF NOT EXISTS "RoomElement" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "positionX" INTEGER NOT NULL DEFAULT 0,
    "positionY" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "rotation" INTEGER DEFAULT 0,
    "metadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomElement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
ALTER TABLE "RoomElement" ADD CONSTRAINT "RoomElement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: Room — add layout geometry columns
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "layoutX" INTEGER;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "layoutY" INTEGER;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "layoutW" INTEGER;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "layoutH" INTEGER;
