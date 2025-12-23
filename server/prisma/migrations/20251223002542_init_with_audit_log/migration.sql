/*
  Warnings:

  - The primary key for the `WorkOrder` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `otNumber` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkOrder" (
    "otNumber" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id" TEXT NOT NULL,
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
INSERT INTO "new_WorkOrder" ("area", "closedDate", "closedTime", "createdAt", "createdBy", "creationDate", "id", "items", "mileage", "plate", "routine", "routineName", "signatureApprover", "signatureReceived", "signatureResponsible", "status", "supplies", "vehicleCode", "vehicleId", "vehicleModel", "vin", "workshop") SELECT "area", "closedDate", "closedTime", "createdAt", "createdBy", "creationDate", "id", "items", "mileage", "plate", "routine", "routineName", "signatureApprover", "signatureReceived", "signatureResponsible", "status", "supplies", "vehicleCode", "vehicleId", "vehicleModel", "vin", "workshop" FROM "WorkOrder";
DROP TABLE "WorkOrder";
ALTER TABLE "new_WorkOrder" RENAME TO "WorkOrder";
CREATE UNIQUE INDEX "WorkOrder_id_key" ON "WorkOrder"("id");
CREATE INDEX "WorkOrder_vehicleId_idx" ON "WorkOrder"("vehicleId");
CREATE INDEX "WorkOrder_plate_idx" ON "WorkOrder"("plate");
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
