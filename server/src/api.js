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

    const maintenanceCycle = Number.isFinite(Number(req.body?.maintenanceCycle))
      ? Number(req.body.maintenanceCycle)
      : (Number.isFinite(Number(req.body?.frequency)) ? Number(req.body.frequency) : undefined);
    
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

    // Apply maintenanceCycle if provided (keep existing if not)
    const vehicleWithCycle = maintenanceCycle
      ? await prisma.vehicle.update({ where: { id: vehicle.id }, data: { maintenanceCycle } })
      : vehicle;
    
    res.json(vehicleWithCycle);
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
            maintenanceCycle: v.maintenanceCycle || v.frequency || 5000,
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
            maintenanceCycle: v.maintenanceCycle || v.frequency || 5000,
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
            { closedDate: 'desc' },
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
          updateData.lastMaintenanceDate = lastClosedOT.closedDate || null;
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
    const { 
      id, vehicleCode, plate, vehicleModel, mileage, routine, routineName,
      items, supplies, workshop, area, vin, status, creationDate 
    } = req.body;
    
    // Find vehicle (crear si no existe para evitar errores)
    let vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { plate },
          { code: vehicleCode }
        ]
      }
    });
    
    // Si no existe el vehículo, crearlo temporalmente
    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          code: vehicleCode,
          plate: plate,
          model: vehicleModel || 'N/A',
          mileage: mileage || 0,
          vin: vin || null
        }
      });
    }
    
    const workOrder = await prisma.workOrder.create({
      data: {
        vehicleId: vehicle.id,
        vehicleCode,
        plate,
        vehicleModel,
        mileage,
        routine: routine || routineName || 'MANTENIMIENTO',
        routineName: routineName || routine,
        items: items ? JSON.stringify(items) : null,
        supplies: supplies ? JSON.stringify(supplies) : null,
        workshop,
        area,
        vin,
        status: status || 'ABIERTA',
        creationDate: creationDate || new Date().toISOString().split('T')[0]
      }
    });

    // Always return the persisted record (id/otNumber) to keep updates consistent.
    res.json(workOrder);
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update work order status
router.patch('/workorders/:id', async (req, res) => {
  try {
    const { status, closedDate, closedTime, signatures, executionKm, mileage } = req.body;

    const toSignatureString = (value) => {
      if (value == null) return null;
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch {
        return null;
      }
    };

    const updateData = {};
    if (status) updateData.status = status;
    if (closedDate) updateData.closedDate = closedDate;
    if (closedTime) updateData.closedTime = closedTime;

    const effectiveKm = Number.isFinite(Number(executionKm))
      ? Number(executionKm)
      : (Number.isFinite(Number(mileage)) ? Number(mileage) : null);

    if (effectiveKm != null && (status === 'CERRADA' || status === 'ABIERTA')) {
      updateData.mileage = effectiveKm;
    }

    if (signatures) {
      updateData.signatureResponsible = toSignatureString(signatures.responsible);
      updateData.signatureApprover = signatures.approver || null;
      updateData.signatureReceived = toSignatureString(signatures.received);
    }
    
    const workOrder = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    // If closing, update vehicle lastMaintenance/mileage and add variable history
    if (status === 'CERRADA' && workOrder) {
      const kmToApply = effectiveKm != null ? effectiveKm : workOrder.mileage;
      const dateToApply = closedDate || workOrder.closedDate || null;

      await prisma.vehicle.update({
        where: { id: workOrder.vehicleId },
        data: {
          mileage: kmToApply,
          lastMaintenance: kmToApply,
          lastMaintenanceDate: dateToApply
        }
      });

      // Create a variable history record so the dashboard reflects the last update immediately
      const ddmmyyyy = (iso) => {
        const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return String(iso || '').trim();
        return `${m[3]}/${m[2]}/${m[1]}`;
      };

      const now = new Date();
      const hhmmss = now.toTimeString().split(' ')[0];
      const historyDate = dateToApply
        ? `${ddmmyyyy(dateToApply)} ${hhmmss}`
        : `${ddmmyyyy(now.toISOString().slice(0, 10))} ${hhmmss}`;

      await prisma.variableHistory.create({
        data: {
          vehicleId: workOrder.vehicleId,
          plate: workOrder.plate,
          code: workOrder.vehicleCode,
          km: kmToApply,
          date: historyDate
        }
      });
    }
    
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete work order (ADMIN)
router.delete('/workorders/:id', async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: { id: req.params.id },
      include: { vehicle: true }
    });

    if (!workOrder) return res.status(404).json({ error: 'Work order not found' });

    const vehicleId = workOrder.vehicleId;
    const closedDateIso = workOrder.closedDate || null;
    const km = Number.isFinite(Number(workOrder.mileage)) ? Number(workOrder.mileage) : null;

    // Attempt to remove the variable history record created during OT close.
    // VariableHistory does not currently store a workOrderId, so we match conservatively.
    if (workOrder.status === 'CERRADA' && vehicleId && km != null && closedDateIso) {
      const ddmmyyyy = (iso) => {
        const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return String(iso || '').trim();
        return `${m[3]}/${m[2]}/${m[1]}`;
      };
      const datePrefixA = ddmmyyyy(closedDateIso);
      const datePrefixB = String(closedDateIso);

      await prisma.variableHistory.deleteMany({
        where: {
          vehicleId,
          km,
          OR: [
            { date: { contains: datePrefixA } },
            { date: { contains: datePrefixB } }
          ]
        }
      });
    }

    // Delete the work order itself
    const deleted = await prisma.workOrder.delete({
      where: { id: req.params.id }
    });

    // If this OT affected the vehicle lastMaintenance, recompute from remaining closed OTs
    let updatedVehicle = null;
    if (vehicleId && workOrder.status === 'CERRADA') {
      const lastClosed = await prisma.workOrder.findFirst({
        where: { vehicleId, status: 'CERRADA' },
        orderBy: [
          { closedDate: 'desc' },
          { mileage: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      if (lastClosed) {
        updatedVehicle = await prisma.vehicle.update({
          where: { id: vehicleId },
          data: {
            lastMaintenance: lastClosed.mileage,
            lastMaintenanceDate: lastClosed.closedDate || null,
            mileage: lastClosed.mileage
          }
        });
      } else {
        updatedVehicle = await prisma.vehicle.update({
          where: { id: vehicleId },
          data: {
            lastMaintenance: null,
            lastMaintenanceDate: null
          }
        });
      }
    }

    res.json({ success: true, workOrder: deleted, updatedVehicle });
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
          { closedDate: 'desc' },
          { mileage: 'desc' }
        ]
      });
      
      if (lastClosedOT) {
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            lastMaintenance: lastClosedOT.mileage,
            lastMaintenanceDate: lastClosedOT.closedDate || null
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

// ============ ADMIN: SEED FLEET ============
// Endpoint para cargar datos iniciales (INITIAL_FLEET) a la BD
router.post('/admin/seed-fleet', async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { vehicles } = req.body;
    
    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de vehículos' });
    }
    
    let created = 0;
    let updated = 0;
    let errors = [];
    
    for (const vehicle of vehicles) {
      try {
        // Verificar si existe
        const existing = await prisma.vehicle.findFirst({
          where: {
            OR: [
              { code: vehicle.code },
              { plate: vehicle.plate }
            ]
          }
        });
        
        const vehicleData = {
          code: vehicle.code,
          plate: vehicle.plate,
          model: vehicle.model || 'N/A',
          brand: vehicle.brand || null,
          owner: vehicle.owner || null,
          mileage: vehicle.mileage || 0,
          lastMaintenance: vehicle.lastMaintenance || null,
          lastMaintenanceDate: vehicle.lastMaintenanceDate || null,
          vin: vehicle.vin || vehicle.serieChasis || null,
          area: vehicle.area || null,
          familiaTipologia: vehicle.familiaTipologia || null,
          descripcion: vehicle.descripcion || null,
          serieChasis: vehicle.serieChasis || vehicle.vin || null,
          serieMotor: vehicle.serieMotor || null,
          anioModelo: vehicle.year ? String(vehicle.year) : vehicle.anioModelo || null,
          estadoActual: vehicle.status || vehicle.estadoActual || 'OPERATIVO',
          ubicacionFrente: vehicle.ubicacionFrente || null
        };
        
        if (existing) {
          await prisma.vehicle.update({
            where: { id: existing.id },
            data: vehicleData
          });
          updated++;
        } else {
          await prisma.vehicle.create({
            data: vehicleData
          });
          created++;
        }
      } catch (error) {
        errors.push({ code: vehicle.code, error: error.message });
      }
    }
    
    res.json({
      success: true,
      created,
      updated,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
