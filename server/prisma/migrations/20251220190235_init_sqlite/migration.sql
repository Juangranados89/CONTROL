-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "brand" TEXT,
    "owner" TEXT,
    "familiaTipologia" TEXT,
    "descripcion" TEXT,
    "serieChasis" TEXT,
    "serieMotor" TEXT,
    "anioModelo" TEXT,
    "estadoActual" TEXT,
    "ubicacionFrente" TEXT,
    "mileage" INTEGER NOT NULL DEFAULT 0,
    "maintenanceCycle" INTEGER NOT NULL DEFAULT 5000,
    "lastMaintenance" INTEGER,
    "lastMaintenanceDate" TEXT,
    "vin" TEXT,
    "area" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "vehicleCode" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "mileage" INTEGER NOT NULL,
    "routine" TEXT NOT NULL,
    "routineName" TEXT,
    "items" TEXT,
    "supplies" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABIERTA',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creationDate" TEXT,
    "closedDate" TEXT,
    "closedTime" TEXT,
    "workshop" TEXT,
    "area" TEXT,
    "vin" TEXT,
    "signatureResponsible" TEXT,
    "signatureApprover" TEXT,
    "signatureReceived" TEXT,
    CONSTRAINT "WorkOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VariableHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "km" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "uploadDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariableHistory_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_code_key" ON "Vehicle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE INDEX "Vehicle_plate_idx" ON "Vehicle"("plate");

-- CreateIndex
CREATE INDEX "Vehicle_code_idx" ON "Vehicle"("code");

-- CreateIndex
CREATE INDEX "Vehicle_familiaTipologia_idx" ON "Vehicle"("familiaTipologia");

-- CreateIndex
CREATE INDEX "Vehicle_owner_idx" ON "Vehicle"("owner");

-- CreateIndex
CREATE INDEX "WorkOrder_vehicleId_idx" ON "WorkOrder"("vehicleId");

-- CreateIndex
CREATE INDEX "WorkOrder_plate_idx" ON "WorkOrder"("plate");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "VariableHistory_vehicleId_idx" ON "VariableHistory"("vehicleId");

-- CreateIndex
CREATE INDEX "VariableHistory_plate_idx" ON "VariableHistory"("plate");

-- CreateIndex
CREATE INDEX "VariableHistory_date_idx" ON "VariableHistory"("date");
