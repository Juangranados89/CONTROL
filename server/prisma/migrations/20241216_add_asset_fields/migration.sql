-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "familiaTipologia" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "descripcion" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "serieChasis" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "serieMotor" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "anioModelo" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "estadoActual" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "ubicacionFrente" TEXT;

-- CreateIndex
CREATE INDEX "Vehicle_familiaTipologia_idx" ON "Vehicle"("familiaTipologia");

-- CreateIndex
CREATE INDEX "Vehicle_owner_idx" ON "Vehicle"("owner");
