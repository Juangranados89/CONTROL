import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// ============ VEHICLES ============

// Get all vehicles
router.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { code: 'asc' }
    });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get vehicle by plate or code
router.get('/vehicles/:identifier', async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { plate: req.params.identifier },
          { code: req.params.identifier }
        ]
      },
      include: {
        variableHistory: { orderBy: { date: 'desc' }, take: 10 },
        workOrders: { orderBy: { createdAt: 'desc' }, take: 20 }
      }
    });
    
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create or update vehicle
router.post('/vehicles', async (req, res) => {
  try {
    const { code, plate, model, brand, owner, mileage, lastMaintenance, lastMaintenanceDate, vin, area } = req.body;
    
    const vehicle = await prisma.vehicle.upsert({
      where: { code },
      update: { plate, model, brand, owner, mileage, lastMaintenance, lastMaintenanceDate, vin, area },
      create: { code, plate, model, brand, owner, mileage, lastMaintenance, lastMaintenanceDate, vin, area }
    });
    
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update vehicles
router.post('/vehicles/bulk', async (req, res) => {
  try {
    const vehicles = req.body;
    
    const results = await Promise.all(
      vehicles.map(v => 
        prisma.vehicle.upsert({
          where: { code: v.code },
          update: v,
          create: v
        })
      )
    );
    
    res.json({ count: results.length, vehicles: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ VARIABLES (MILEAGE HISTORY) ============

// Get variable history
router.get('/variables', async (req, res) => {
  try {
    const { plate, code, startDate, endDate } = req.query;
    
    const where = {};
    if (plate) where.plate = plate;
    if (code) where.code = code;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }
    
    const history = await prisma.variableHistory.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 1000
    });
    
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save variable history (bulk)
router.post('/variables', async (req, res) => {
  try {
    const records = req.body;
    
    // Update vehicles mileage and create history records
    const results = await Promise.all(
      records.map(async (record) => {
        // Find vehicle
        const vehicle = await prisma.vehicle.findFirst({
          where: {
            OR: [
              { plate: record.plate },
              { code: record.code }
            ]
          }
        });
        
        if (!vehicle) return null;
        
        // Update vehicle mileage
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { mileage: record.km }
        });
        
        // Create history record
        return prisma.variableHistory.create({
          data: {
            vehicleId: vehicle.id,
            plate: record.plate,
            code: record.code,
            km: record.km,
            date: record.date
          }
        });
      })
    );
    
    res.json({ count: results.filter(r => r).length, records: results.filter(r => r) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WORK ORDERS ============

// Get work orders
router.get('/workorders', async (req, res) => {
  try {
    const { status, plate } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (plate) where.plate = plate;
    
    const orders = await prisma.workOrder.findMany({
      where,
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create work order
router.post('/workorders', async (req, res) => {
  try {
    const { vehicleCode, plate, vehicleModel, mileage, routine, workshop, area, vin } = req.body;
    
    // Find vehicle
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { plate },
          { code: vehicleCode }
        ]
      }
    });
    
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    
    const workOrder = await prisma.workOrder.create({
      data: {
        vehicleId: vehicle.id,
        vehicleCode,
        plate,
        vehicleModel,
        mileage,
        routine,
        workshop,
        area,
        vin
      }
    });
    
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update work order status
router.patch('/workorders/:id', async (req, res) => {
  try {
    const { status, closingDate } = req.body;
    
    const workOrder = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: { status, closingDate }
    });
    
    // If closing, update vehicle lastMaintenance
    if (status === 'CERRADA' && workOrder) {
      await prisma.vehicle.update({
        where: { id: workOrder.vehicleId },
        data: {
          lastMaintenance: workOrder.mileage,
          lastMaintenanceDate: closingDate
        }
      });
    }
    
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
