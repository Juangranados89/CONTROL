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
    const { 
      code, plate, model, brand, owner, mileage, lastMaintenance, lastMaintenanceDate, 
      vin, area, familiaTipologia, descripcion, serieChasis, serieMotor, anioModelo, 
      estadoActual, ubicacionFrente 
    } = req.body;
    
    const vehicle = await prisma.vehicle.upsert({
      where: { code },
      update: { 
        plate, model, brand, owner, mileage, lastMaintenance, lastMaintenanceDate, 
        vin, area, familiaTipologia, descripcion, serieChasis, serieMotor, anioModelo, 
        estadoActual, ubicacionFrente 
      },
      create: { 
        code, plate, model, brand, owner, mileage, lastMaintenance, lastMaintenanceDate, 
        vin, area, familiaTipologia, descripcion, serieChasis, serieMotor, anioModelo, 
        estadoActual, ubicacionFrente 
      }
    });
    
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update vehicles (Resilient with filtering for CAMIONETA + PROPIO)
router.post('/vehicles/bulk', async (req, res) => {
  try {
    const vehicles = req.body;
    const results = [];
    const filtered = [];
    const errors = [];
    
    for (const v of vehicles) {
      try {
        // Filtrado resiliente: solo CAMIONETAS y PROPIOS
        const familia = (v.familiaTipologia || '').toUpperCase().trim();
        const propietario = (v.owner || '').toUpperCase().trim();
        
        // Verificar que sea CAMIONETA
        const esCamioneta = familia.includes('CAMIONETA') || familia.includes('PICKUP');
        
        // Verificar que sea PROPIO
        const esPropio = propietario.includes('PROPIO') || propietario === 'PROPIO';
        
        if (!esCamioneta) {
          filtered.push({ 
            code: v.code, 
            plate: v.plate,
            reason: `Familia/Tipología "${v.familiaTipologia}" no es CAMIONETA` 
          });
          continue;
        }
        
        if (!esPropio) {
          filtered.push({ 
            code: v.code, 
            plate: v.plate,
            reason: `Owner "${v.owner}" no es PROPIO` 
          });
          continue;
        }
        
        // Validar campos requeridos
        if (!v.code || !v.plate) {
          errors.push({ 
            record: v, 
            error: 'Código y Placa son requeridos' 
          });
          continue;
        }
        
        // Crear o actualizar vehículo
        const vehicle = await prisma.vehicle.upsert({
          where: { code: v.code },
          update: {
            plate: v.plate,
            model: v.model || v.modeloLinea,
            brand: v.brand || v.marca,
            owner: v.owner,
            familiaTipologia: v.familiaTipologia,
            descripcion: v.descripcion,
            serieChasis: v.serieChasis || v.vin,
            serieMotor: v.serieMotor,
            anioModelo: v.anioModelo,
            estadoActual: v.estadoActual,
            ubicacionFrente: v.ubicacionFrente,
            mileage: v.mileage || 0,
            lastMaintenance: v.lastMaintenance,
            lastMaintenanceDate: v.lastMaintenanceDate,
            vin: v.vin || v.serieChasis,
            area: v.area || v.ubicacionFrente
          },
          create: {
            code: v.code,
            plate: v.plate,
            model: v.model || v.modeloLinea || 'N/A',
            brand: v.brand || v.marca,
            owner: v.owner,
            familiaTipologia: v.familiaTipologia,
            descripcion: v.descripcion,
            serieChasis: v.serieChasis || v.vin,
            serieMotor: v.serieMotor,
            anioModelo: v.anioModelo,
            estadoActual: v.estadoActual,
            ubicacionFrente: v.ubicacionFrente,
            mileage: v.mileage || 0,
            lastMaintenance: v.lastMaintenance,
            lastMaintenanceDate: v.lastMaintenanceDate,
            vin: v.vin || v.serieChasis,
            area: v.area || v.ubicacionFrente
          }
        });
        
        results.push(vehicle);
        
      } catch (error) {
        errors.push({ record: v, error: error.message });
      }
    }
    
    res.json({ 
      success: true,
      imported: results.length, 
      vehicles: results,
      filtered: filtered.length,
      filteredRecords: filtered,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: vehicles.length,
        imported: results.length,
        filteredOut: filtered.length,
        failed: errors.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete vehicle by ID
router.delete('/vehicles/:id', async (req, res) => {
  try {
    // Delete related records first
    await prisma.variableHistory.deleteMany({
      where: { vehicleId: req.params.id }
    });
    
    await prisma.workOrder.deleteMany({
      where: { vehicleId: req.params.id }
    });
    
    // Delete vehicle
    const vehicle = await prisma.vehicle.delete({
      where: { id: req.params.id }
    });
    
    res.json({ success: true, vehicle });
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

// Save variable history (bulk) - Resilient & Intelligent
router.post('/variables', async (req, res) => {
  try {
    const records = req.body;
    const results = [];
    const errors = [];
    
    // Process each record individually for resilience
    for (const record of records) {
      try {
        // Find vehicle
        const vehicle = await prisma.vehicle.findFirst({
          where: {
            OR: [
              { plate: record.plate },
              { code: record.code }
            ]
          }
        });
        
        if (!vehicle) {
          errors.push({ record, error: 'Vehicle not found' });
          continue;
        }
        
        // Find last closed work order for this vehicle
        const lastClosedOT = await prisma.workOrder.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: 'CERRADA'
          },
          orderBy: [
            { closingDate: 'desc' },
            { mileage: 'desc' }
          ]
        });
        
        // Prepare update data
        const updateData = {
          mileage: record.km
        };
        
        // Intelligent update: if we have a closed OT, update lastMaintenance fields
        if (lastClosedOT) {
          updateData.lastMaintenance = lastClosedOT.mileage;
          updateData.lastMaintenanceDate = lastClosedOT.closingDate || null;
        }
        
        // Update vehicle with mileage and intelligent maintenance data
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: updateData
        });
        
        // Create history record
        const historyRecord = await prisma.variableHistory.create({
          data: {
            vehicleId: vehicle.id,
            plate: record.plate,
            code: record.code,
            km: record.km,
            date: record.date
          }
        });
        
        results.push(historyRecord);
        
      } catch (error) {
        errors.push({ record, error: error.message });
      }
    }
    
    res.json({ 
      success: true,
      count: results.length, 
      records: results,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
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

// Sync all vehicles with their latest closed work orders (intelligent sync)
router.post('/vehicles/sync-maintenance', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany();
    const updates = [];
    
    for (const vehicle of vehicles) {
      // Find last closed work order
      const lastClosedOT = await prisma.workOrder.findFirst({
        where: {
          vehicleId: vehicle.id,
          status: 'CERRADA'
        },
        orderBy: [
          { closingDate: 'desc' },
          { mileage: 'desc' }
        ]
      });
      
      if (lastClosedOT) {
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            lastMaintenance: lastClosedOT.mileage,
            lastMaintenanceDate: lastClosedOT.closingDate
          }
        });
        updates.push({ code: vehicle.code, lastMaintenance: lastClosedOT.mileage });
      }
    }
    
    res.json({ 
      success: true, 
      updated: updates.length, 
      vehicles: updates 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
