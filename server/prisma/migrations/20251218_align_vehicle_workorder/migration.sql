-- Align database schema with current Prisma models (Vehicle + WorkOrder)

-- ============ WORKORDER ============

-- Rename legacy column closingDate -> closedDate (if applicable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkOrder' AND column_name = 'closingDate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'WorkOrder' AND column_name = 'closedDate'
  ) THEN
    ALTER TABLE "WorkOrder" RENAME COLUMN "closingDate" TO "closedDate";
  END IF;
END $$;

-- Add missing columns
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "routineName" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "items" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "supplies" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "creationDate" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "closedDate" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "closedTime" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "signatureResponsible" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "signatureApprover" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "signatureReceived" TEXT;

-- Ensure status default matches current app semantics
ALTER TABLE "WorkOrder" ALTER COLUMN "status" SET DEFAULT 'ABIERTA';

-- ============ VEHICLE ============

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "familiaTipologia" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "descripcion" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "serieChasis" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "serieMotor" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "anioModelo" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "estadoActual" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "ubicacionFrente" TEXT;

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS "Vehicle_familiaTipologia_idx" ON "Vehicle"("familiaTipologia");
CREATE INDEX IF NOT EXISTS "Vehicle_owner_idx" ON "Vehicle"("owner");
