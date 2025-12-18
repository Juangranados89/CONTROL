-- Add maintenanceCycle to Vehicle to persist imported maintenance cycle (e.g. 5000/7000/10000)
ALTER TABLE "Vehicle"
ADD COLUMN IF NOT EXISTS "maintenanceCycle" INTEGER NOT NULL DEFAULT 5000;
