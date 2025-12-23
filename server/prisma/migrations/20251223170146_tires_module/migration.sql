-- CreateTable
CREATE TABLE "Tire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marking" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "dimension" TEXT,
    "dot" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TireMount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tireId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "mountedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unmountedAt" DATETIME,
    "mountedKm" INTEGER,
    "unmountedKm" INTEGER,
    "mountedHours" INTEGER,
    "unmountedHours" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TireMount_tireId_fkey" FOREIGN KEY ("tireId") REFERENCES "Tire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TireMount_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TireInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tireId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "inspectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odometerKm" INTEGER,
    "hours" INTEGER,
    "psiCold" REAL,
    "depthExt" REAL,
    "depthCen" REAL,
    "depthInt" REAL,
    "wearPct" REAL,
    "actionRotate" BOOLEAN NOT NULL DEFAULT false,
    "actionAlign" BOOLEAN NOT NULL DEFAULT false,
    "actionRemoveFromService" BOOLEAN NOT NULL DEFAULT false,
    "damageCutSidewall" BOOLEAN NOT NULL DEFAULT false,
    "damageCutTread" BOOLEAN NOT NULL DEFAULT false,
    "damageWearStepped" BOOLEAN NOT NULL DEFAULT false,
    "damageRunLowPsi" BOOLEAN NOT NULL DEFAULT false,
    "damageRimHit" BOOLEAN NOT NULL DEFAULT false,
    "damageNotRecap" BOOLEAN NOT NULL DEFAULT false,
    "damageDualMismatch" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TireInspection_tireId_fkey" FOREIGN KEY ("tireId") REFERENCES "Tire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TireInspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tire_marking_key" ON "Tire"("marking");

-- CreateIndex
CREATE INDEX "Tire_marking_idx" ON "Tire"("marking");

-- CreateIndex
CREATE INDEX "TireMount_vehicleId_position_idx" ON "TireMount"("vehicleId", "position");

-- CreateIndex
CREATE INDEX "TireMount_tireId_idx" ON "TireMount"("tireId");

-- CreateIndex
CREATE INDEX "TireMount_unmountedAt_idx" ON "TireMount"("unmountedAt");

-- CreateIndex
CREATE INDEX "TireInspection_vehicleId_inspectedAt_idx" ON "TireInspection"("vehicleId", "inspectedAt");

-- CreateIndex
CREATE INDEX "TireInspection_tireId_inspectedAt_idx" ON "TireInspection"("tireId", "inspectedAt");

-- CreateIndex
CREATE INDEX "TireInspection_vehicleId_position_inspectedAt_idx" ON "TireInspection"("vehicleId", "position", "inspectedAt");
