import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const router = express.Router();
const prisma = new PrismaClient();

const logAction = async (userId, action, entityType, entityId, details, userEmail = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: entityType,
        entityId: String(entityId),
        userEmail: userEmail || null,
        details: details ? JSON.stringify(details) : null
      }
    });
  } catch (e) {
    console.error('Failed to log action:', e);
  }
};

// ============ WORK ORDER AUDIT / BITACORA ============

router.get('/workorders/:id/audit', async (req, res) => {
  try {
    const workOrderId = String(req.params.id);

    const rows = await prisma.auditLog.findMany({
      where: {
        entity: 'WORK_ORDER',
        entityId: workOrderId
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workorders/:id/notes', async (req, res) => {
  try {
    const workOrderId = String(req.params.id);
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const entry = await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        action: 'WORK_ORDER_NOTE',
        entity: 'WORK_ORDER',
        entityId: workOrderId,
        details: JSON.stringify({ message })
      }
    });

    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let bdOrtizSerialMap = null;

const normalizeLookupKey = (value) => {
  const str = String(value || '').toUpperCase();
  // Keep alphanumerics only to tolerate formats like "PWL-494" vs "PWL494".
  return str.replace(/[^A-Z0-9]/g, '');
};

const buildSerialMapFromBdOrtiz = () => {
  try {
    const excelPath = path.resolve(__dirname, '../../BD-ORTIZ.xlsx');
    const workbook = xlsx.readFile(excelPath, { cellDates: false });
    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) return { byCode: new Map(), byPlate: new Map() };

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const row = rows[i] || [];
      const upper = row.map(v => String(v || '').toUpperCase());
      const hasCode = upper.some(v => v.includes('CODIGO DEL EQUIPO'));
      const hasPlate = upper.some(v => v.includes('PLACA'));
      const hasSerial = upper.some(v => v.includes('SERIE CHASIS') || v.includes('VIN'));
      if (hasCode && hasPlate && hasSerial) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex < 0) return { byCode: new Map(), byPlate: new Map() };

    const header = (rows[headerRowIndex] || []).map(v => String(v || '').toUpperCase().trim());
    const colIndex = (needle) => header.findIndex(h => h === needle);

    const idxCode = colIndex('CODIGO DEL EQUIPO');
    const idxPlate = colIndex('PLACA');
    const idxSerial = header.findIndex(h => h.includes('SERIE CHASIS') || h.includes('VIN'));

    if (idxCode < 0 || idxPlate < 0 || idxSerial < 0) return { byCode: new Map(), byPlate: new Map() };

    const byCode = new Map();
    const byPlate = new Map();

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const code = String(row[idxCode] || '').trim();
      const plate = String(row[idxPlate] || '').trim();
      const serial = String(row[idxSerial] || '').trim();
      if (!serial) continue;

      if (code) byCode.set(normalizeLookupKey(code), serial);
      if (plate) byPlate.set(normalizeLookupKey(plate), serial);
    }

    return { byCode, byPlate };
  } catch (e) {
    console.warn('BD-ORTIZ.xlsx no disponible o no se pudo leer:', e?.message || e);
    return { byCode: new Map(), byPlate: new Map() };
  }
};

const ensureBdOrtizSerialMap = () => {
  if (!bdOrtizSerialMap) bdOrtizSerialMap = buildSerialMapFromBdOrtiz();
  return bdOrtizSerialMap;
};

const lookupSerialFromBdOrtiz = (code, plate) => {
  const map = ensureBdOrtizSerialMap();
  const codeKey = normalizeLookupKey(code);
  const plateKey = normalizeLookupKey(plate);
  return (codeKey && map.byCode.get(codeKey)) || (plateKey && map.byPlate.get(plateKey)) || null;
};

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

    const incomingSerial = (vin || serieChasis || '').trim();
    const bdSerial = !incomingSerial ? lookupSerialFromBdOrtiz(code, plate) : null;
    const serialToUse = incomingSerial || bdSerial || null;

    const maintenanceCycle = Number.isFinite(Number(req.body?.maintenanceCycle))
      ? Number(req.body.maintenanceCycle)
      : (Number.isFinite(Number(req.body?.frequency)) ? Number(req.body.frequency) : undefined);
    
    const vehicle = await prisma.vehicle.upsert({
      where: { code },
      update: { 
        plate, model, brand, owner, mileage, lastMaintenance, lastMaintenanceDate, 
        vin: serialToUse ?? vin,
        area, familiaTipologia, descripcion,
        serieChasis: serialToUse ?? serieChasis,
        serieMotor, anioModelo,
        estadoActual, ubicacionFrente 
      },
      create: { 
        code, plate, model, brand, owner, mileage, lastMaintenance, lastMaintenanceDate, 
        vin: serialToUse ?? vin,
        area, familiaTipologia, descripcion,
        serieChasis: serialToUse ?? serieChasis,
        serieMotor, anioModelo,
        estadoActual, ubicacionFrente 
      }
    });

    // Apply maintenanceCycle if provided (keep existing if not)
    const vehicleWithCycle = maintenanceCycle
      ? await prisma.vehicle.update({ where: { id: vehicle.id }, data: { maintenanceCycle } })
      : vehicle;
    
    await logAction(
      req.user.id,
      'UPDATE_VEHICLE',
      'VEHICLE',
      vehicle.id,
      { code: vehicle.code, plate: vehicle.plate, status: vehicle.estadoActual }
    );

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

        const incomingSerial = String(v.vin || v.serieChasis || '').trim();
        const serialToUse = incomingSerial || lookupSerialFromBdOrtiz(v.code, v.plate) || null;
        
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
            vin: v.vin || serialToUse || null,
            serieChasis: v.serieChasis || serialToUse || v.vin,
            serieMotor: v.serieMotor,
            anioModelo: v.anioModelo,
            estadoActual: v.estadoActual,
            ubicacionFrente: v.ubicacionFrente,
            mileage: v.mileage || 0,
            maintenanceCycle: v.maintenanceCycle || v.frequency || 5000,
            lastMaintenance: v.lastMaintenance,
            lastMaintenanceDate: v.lastMaintenanceDate,
            vin: v.vin || serialToUse || v.serieChasis,
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
            vin: v.vin || serialToUse || null,
            serieChasis: v.serieChasis || serialToUse || v.vin,
            serieMotor: v.serieMotor,
            anioModelo: v.anioModelo,
            estadoActual: v.estadoActual,
            ubicacionFrente: v.ubicacionFrente,
            mileage: v.mileage || 0,
            maintenanceCycle: v.maintenanceCycle || v.frequency || 5000,
            lastMaintenance: v.lastMaintenance,
            lastMaintenanceDate: v.lastMaintenanceDate,
            vin: v.vin || serialToUse || v.serieChasis,
            area: v.area || v.ubicacionFrente
          }
        });
        
        results.push(vehicle);
        
      } catch (error) {
        errors.push({ record: v, error: error.message });
      }
    }
    
    if (results.length > 0) {
      await logAction(
        req.user.id,
        'BULK_UPDATE_VEHICLES',
        'VEHICLE',
        'MULTIPLE',
        { count: results.length }
      );
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
      const incomingSerial = String(vin || '').trim();
      const serialToUse = incomingSerial || lookupSerialFromBdOrtiz(vehicleCode, plate) || null;
      vehicle = await prisma.vehicle.create({
        data: {
          code: vehicleCode,
          plate: plate,
          model: vehicleModel || 'N/A',
          mileage: mileage || 0,
          vin: serialToUse,
          serieChasis: serialToUse
        }
      });
    }

    const incomingSerial = String(vin || '').trim();
    const vehicleSerial = String(vehicle?.vin || vehicle?.serieChasis || '').trim();
    const bdSerial = lookupSerialFromBdOrtiz(vehicleCode, plate);
    const serialToUse = incomingSerial || vehicleSerial || bdSerial || null;

    // If we found a serial and the vehicle doesn't have one yet, persist it.
    if (serialToUse && !vehicleSerial && vehicle?.id) {
      try {
        vehicle = await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { vin: serialToUse, serieChasis: serialToUse }
        });
      } catch {
        // Best-effort: do not block OT creation.
      }
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
        vin: serialToUse,
        status: status || 'ABIERTA',
        creationDate: creationDate || new Date().toISOString().split('T')[0]
      }
    });

    await logAction(
      req.user.id,
      'CREATE_WORK_ORDER',
      'WORK_ORDER',
      workOrder.id,
      { otNumber: workOrder.otNumber, plate: workOrder.plate, routine: workOrder.routine },
      req.user?.email
    );

    // Always return the persisted record (id/otNumber) to keep updates consistent.
    res.json(workOrder);
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ error: error.message });
  }
});

// ADMIN: Backfill seriales desde BD-ORTIZ.xlsx
router.post('/admin/backfill-serials', async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    ensureBdOrtizSerialMap();

    const vehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          { vin: null },
          { vin: '' },
          { serieChasis: null },
          { serieChasis: '' }
        ]
      },
      select: { id: true, code: true, plate: true, vin: true, serieChasis: true }
    });

    let updated = 0;
    let notFound = 0;

    for (const v of vehicles) {
      const serial = lookupSerialFromBdOrtiz(v.code, v.plate);
      if (!serial) {
        notFound += 1;
        continue;
      }
      await prisma.vehicle.update({
        where: { id: v.id },
        data: {
          vin: v.vin && String(v.vin).trim() ? v.vin : serial,
          serieChasis: v.serieChasis && String(v.serieChasis).trim() ? v.serieChasis : serial
        }
      });
      updated += 1;
    }

    res.json({ success: true, candidates: vehicles.length, updated, notFound });
  } catch (error) {
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
    
    await logAction(
      req.user.id,
      'UPDATE_WORK_ORDER',
      'WORK_ORDER',
      workOrder.id,
      { status: workOrder.status, otNumber: workOrder.otNumber },
      req.user?.email
    );

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

    await logAction(
      req.user.id,
      'DELETE_WORK_ORDER',
      'WORK_ORDER',
      deleted.id,
      { otNumber: deleted.otNumber, plate: deleted.plate },
      req.user?.email
    );

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

// ============ TIRES (CONTROL DE LLANTAS) ============

const normalizeTireMarking = (value) => String(value || '').trim().toUpperCase();

const resolveVehicleByIdentifier = async (identifier) => {
  const raw = String(identifier || '').trim();
  if (!raw) return null;

  return prisma.vehicle.findFirst({
    where: {
      OR: [
        { id: raw },
        { code: raw },
        { plate: raw }
      ]
    }
  });
};

const normalizeLayout = (value) => {
  const n = Number(value);
  if (n === 5 || n === 11 || n === 13) return n;
  return 5;
};

const buildPositionLabels = (layout) => {
  const result = [];
  for (let p = 1; p <= layout; p++) {
    const label = p === layout ? 'RE' : String(p);
    result.push({ position: p, label });
  }
  return result;
};

router.get('/tires/vehicles/:identifier/overview', async (req, res) => {
  try {
    const layout = normalizeLayout(req.query.layout);
    const vehicle = await resolveVehicleByIdentifier(req.params.identifier);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const [mounts, recentInspections] = await Promise.all([
      prisma.tireMount.findMany({
        where: { vehicleId: vehicle.id, unmountedAt: null },
        include: { tire: true }
      }),
      prisma.tireInspection.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { inspectedAt: 'desc' },
        include: { tire: true },
        take: 500
      })
    ]);

    const mountByPosition = new Map();
    for (const m of mounts) mountByPosition.set(m.position, m);

    const lastInspectionByPosition = new Map();
    for (const insp of recentInspections) {
      if (!lastInspectionByPosition.has(insp.position)) {
        lastInspectionByPosition.set(insp.position, insp);
      }
    }

    const positions = buildPositionLabels(layout).map(({ position, label }) => {
      const mount = mountByPosition.get(position) || null;
      const lastInspection = lastInspectionByPosition.get(position) || null;
      return {
        position,
        label,
        mount: mount
          ? {
              id: mount.id,
              mountedAt: mount.mountedAt,
              tire: mount.tire ? { 
                id: mount.tire.id, 
                marking: mount.tire.marking,
                dimension: mount.tire.dimension,
                brand: mount.tire.brand,
                model: mount.tire.model
              } : null
            }
          : null,
        lastInspection: lastInspection
          ? {
              id: lastInspection.id,
              inspectedAt: lastInspection.inspectedAt,
              odometerKm: lastInspection.odometerKm,
              hours: lastInspection.hours,
              psiCold: lastInspection.psiCold,
              depthExt: lastInspection.depthExt,
              depthCen: lastInspection.depthCen,
              depthInt: lastInspection.depthInt,
              wearPct: lastInspection.wearPct,
              actionRotate: lastInspection.actionRotate,
              actionAlign: lastInspection.actionAlign,
              actionRemoveFromService: lastInspection.actionRemoveFromService,
              notes: lastInspection.notes,
              tire: lastInspection.tire ? { 
                id: lastInspection.tire.id, 
                marking: lastInspection.tire.marking,
                dimension: lastInspection.tire.dimension,
                brand: lastInspection.tire.brand,
                model: lastInspection.tire.model
              } : null
            }
          : null
      };
    });

    res.json({
      vehicle,
      layout,
      positions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tires/inspections', async (req, res) => {
  try {
    const vehicleIdOrIdentifier = req.body?.vehicleId || req.body?.vehicleIdentifier || req.body?.vehicleCode || req.body?.plate;
    const vehicle = await resolveVehicleByIdentifier(vehicleIdOrIdentifier);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const position = Number(req.body?.position);
    if (!Number.isFinite(position) || position <= 0) {
      return res.status(400).json({ error: 'position is required' });
    }

    const marking = normalizeTireMarking(req.body?.tireMarking || req.body?.marking);
    if (!marking) {
      return res.status(400).json({ error: 'tireMarking is required' });
    }

    const inspectedAtRaw = req.body?.inspectedAt;
    const inspectedAt = inspectedAtRaw ? new Date(inspectedAtRaw) : new Date();
    if (Number.isNaN(inspectedAt.getTime())) {
      return res.status(400).json({ error: 'inspectedAt is invalid' });
    }

    const odometerKm = Number.isFinite(Number(req.body?.odometerKm)) ? Number(req.body.odometerKm) : null;
    const hours = Number.isFinite(Number(req.body?.hours)) ? Number(req.body.hours) : null;
    const psiCold = Number.isFinite(Number(req.body?.psiCold)) ? Number(req.body.psiCold) : null;
    const depthExt = Number.isFinite(Number(req.body?.depthExt)) ? Number(req.body.depthExt) : null;
    const depthCen = Number.isFinite(Number(req.body?.depthCen)) ? Number(req.body.depthCen) : null;
    const depthInt = Number.isFinite(Number(req.body?.depthInt)) ? Number(req.body.depthInt) : null;
    const wearPct = Number.isFinite(Number(req.body?.wearPct)) ? Number(req.body.wearPct) : null;

    const bool = (v) => v === true || v === 1 || v === '1' || String(v || '').toUpperCase() === 'SI' || String(v || '').toUpperCase() === 'X';

    const tire = await prisma.tire.upsert({
      where: { marking },
      update: {},
      create: {
        marking,
        brand: req.body?.brand || null,
        model: req.body?.model || null,
        dimension: req.body?.dimension || null,
        dot: req.body?.dot || null,
        notes: req.body?.tireNotes || null
      }
    });

    // Mount handling (best-effort, keeps only one active mount per tire/position at app-level)
    const existingMountSamePos = await prisma.tireMount.findFirst({
      where: { vehicleId: vehicle.id, position, unmountedAt: null }
    });

    if (!existingMountSamePos || existingMountSamePos.tireId !== tire.id) {
      await prisma.tireMount.updateMany({
        where: { vehicleId: vehicle.id, position, unmountedAt: null },
        data: { unmountedAt: inspectedAt, unmountedKm: odometerKm, unmountedHours: hours }
      });

      await prisma.tireMount.updateMany({
        where: { tireId: tire.id, unmountedAt: null },
        data: { unmountedAt: inspectedAt, unmountedKm: odometerKm, unmountedHours: hours }
      });

      await prisma.tireMount.create({
        data: {
          tireId: tire.id,
          vehicleId: vehicle.id,
          position,
          mountedAt: inspectedAt,
          mountedKm: odometerKm,
          mountedHours: hours
        }
      });
    }

    const inspection = await prisma.tireInspection.create({
      data: {
        tireId: tire.id,
        vehicleId: vehicle.id,
        position,
        inspectedAt,
        odometerKm,
        hours,
        psiCold,
        depthExt,
        depthCen,
        depthInt,
        wearPct,
        actionRotate: bool(req.body?.actionRotate),
        actionAlign: bool(req.body?.actionAlign),
        actionRemoveFromService: bool(req.body?.actionRemoveFromService),
        damageCutSidewall: bool(req.body?.damageCutSidewall),
        damageCutTread: bool(req.body?.damageCutTread),
        damageWearStepped: bool(req.body?.damageWearStepped),
        damageRunLowPsi: bool(req.body?.damageRunLowPsi),
        damageRimHit: bool(req.body?.damageRimHit),
        damageNotRecap: bool(req.body?.damageNotRecap),
        damageDualMismatch: bool(req.body?.damageDualMismatch),
        notes: req.body?.notes || null
      },
      include: { tire: true, vehicle: true }
    });

    await logAction(
      req.user?.id || null,
      'CREATE_TIRE_INSPECTION',
      'TIRE_INSPECTION',
      inspection.id,
      { vehicleId: vehicle.id, position, marking: tire.marking, inspectedAt: inspection.inspectedAt }
    );

    res.json(inspection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tires/vehicles/:identifier/inspections', async (req, res) => {
  try {
    const vehicle = await resolveVehicleByIdentifier(req.params.identifier);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const position = req.query.position != null && String(req.query.position).trim() !== ''
      ? Number(req.query.position)
      : null;

    const take = Number.isFinite(Number(req.query.take)) ? Math.min(1000, Math.max(1, Number(req.query.take))) : 200;
    const skip = Number.isFinite(Number(req.query.skip)) ? Math.max(0, Number(req.query.skip)) : 0;

    const where = {
      vehicleId: vehicle.id,
      ...(Number.isFinite(position) ? { position } : {})
    };

    const rows = await prisma.tireInspection.findMany({
      where,
      orderBy: { inspectedAt: 'desc' },
      include: { tire: true },
      take,
      skip
    });

    res.json({ vehicle, count: rows.length, inspections: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tires/tires/:marking/inspections', async (req, res) => {
  try {
    const marking = normalizeTireMarking(req.params.marking);
    if (!marking) return res.status(400).json({ error: 'marking is required' });

    const tire = await prisma.tire.findUnique({ where: { marking } });
    if (!tire) return res.status(404).json({ error: 'Tire not found' });

    const take = Number.isFinite(Number(req.query.take)) ? Math.min(1000, Math.max(1, Number(req.query.take))) : 200;
    const skip = Number.isFinite(Number(req.query.skip)) ? Math.max(0, Number(req.query.skip)) : 0;

    const rows = await prisma.tireInspection.findMany({
      where: { tireId: tire.id },
      orderBy: { inspectedAt: 'desc' },
      include: { vehicle: true },
      take,
      skip
    });

    res.json({ tire, count: rows.length, inspections: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tires/mounts/mount', async (req, res) => {
  try {
    const vehicleIdOrIdentifier = req.body?.vehicleId || req.body?.vehicleIdentifier || req.body?.vehicleCode || req.body?.plate;
    const vehicle = await resolveVehicleByIdentifier(vehicleIdOrIdentifier);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const position = Number(req.body?.position);
    if (!Number.isFinite(position) || position <= 0) {
      return res.status(400).json({ error: 'position is required' });
    }

    const marking = normalizeTireMarking(req.body?.tireMarking || req.body?.marking);
    if (!marking) {
      return res.status(400).json({ error: 'tireMarking is required' });
    }

    const mountedAtRaw = req.body?.mountedAt;
    const mountedAt = mountedAtRaw ? new Date(mountedAtRaw) : new Date();
    if (Number.isNaN(mountedAt.getTime())) {
      return res.status(400).json({ error: 'mountedAt is invalid' });
    }

    const mountedKm = Number.isFinite(Number(req.body?.mountedKm)) ? Number(req.body.mountedKm) : null;
    const mountedHours = Number.isFinite(Number(req.body?.mountedHours)) ? Number(req.body.mountedHours) : null;

    const tire = await prisma.tire.upsert({
      where: { marking },
      update: {},
      create: {
        marking,
        brand: req.body?.brand || null,
        model: req.body?.model || null,
        dimension: req.body?.dimension || null,
        dot: req.body?.dot || null,
        notes: req.body?.tireNotes || null
      }
    });

    // Ensure target position is free
    await prisma.tireMount.updateMany({
      where: { vehicleId: vehicle.id, position, unmountedAt: null },
      data: { unmountedAt: mountedAt, unmountedKm: mountedKm, unmountedHours: mountedHours }
    });

    // Ensure tire is not mounted elsewhere
    await prisma.tireMount.updateMany({
      where: { tireId: tire.id, unmountedAt: null },
      data: { unmountedAt: mountedAt, unmountedKm: mountedKm, unmountedHours: mountedHours }
    });

    const mount = await prisma.tireMount.create({
      data: {
        tireId: tire.id,
        vehicleId: vehicle.id,
        position,
        mountedAt,
        mountedKm,
        mountedHours
      },
      include: { tire: true, vehicle: true }
    });

    await logAction(
      req.user?.id || null,
      'TIRE_MOUNT',
      'TIRE_MOUNT',
      mount.id,
      { vehicleId: vehicle.id, position, marking: tire.marking, mountedAt },
      req.user?.email
    );

    res.json(mount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tires/mounts/dismount', async (req, res) => {
  try {
    const vehicleIdOrIdentifier = req.body?.vehicleId || req.body?.vehicleIdentifier || req.body?.vehicleCode || req.body?.plate;
    const vehicle = await resolveVehicleByIdentifier(vehicleIdOrIdentifier);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const position = Number(req.body?.position);
    if (!Number.isFinite(position) || position <= 0) {
      return res.status(400).json({ error: 'position is required' });
    }

    const unmountedAtRaw = req.body?.unmountedAt;
    const unmountedAt = unmountedAtRaw ? new Date(unmountedAtRaw) : new Date();
    if (Number.isNaN(unmountedAt.getTime())) {
      return res.status(400).json({ error: 'unmountedAt is invalid' });
    }

    const unmountedKm = Number.isFinite(Number(req.body?.unmountedKm)) ? Number(req.body.unmountedKm) : null;
    const unmountedHours = Number.isFinite(Number(req.body?.unmountedHours)) ? Number(req.body.unmountedHours) : null;

    const active = await prisma.tireMount.findFirst({
      where: { vehicleId: vehicle.id, position, unmountedAt: null },
      include: { tire: true }
    });

    if (!active) {
      return res.status(404).json({ error: 'No active mount in this position' });
    }

    const updated = await prisma.tireMount.update({
      where: { id: active.id },
      data: { unmountedAt, unmountedKm, unmountedHours },
      include: { tire: true, vehicle: true }
    });

    await logAction(
      req.user?.id || null,
      'TIRE_DISMOUNT',
      'TIRE_MOUNT',
      updated.id,
      { vehicleId: vehicle.id, position, marking: active.tire?.marking || null, unmountedAt },
      req.user?.email
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tires/mounts/move', async (req, res) => {
  try {
    const vehicleIdOrIdentifier = req.body?.vehicleId || req.body?.vehicleIdentifier || req.body?.vehicleCode || req.body?.plate;
    const vehicle = await resolveVehicleByIdentifier(vehicleIdOrIdentifier);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const fromPosition = Number(req.body?.fromPosition);
    const toPosition = Number(req.body?.toPosition);
    if (!Number.isFinite(fromPosition) || fromPosition <= 0) {
      return res.status(400).json({ error: 'fromPosition is required' });
    }
    if (!Number.isFinite(toPosition) || toPosition <= 0) {
      return res.status(400).json({ error: 'toPosition is required' });
    }
    if (fromPosition === toPosition) {
      return res.status(400).json({ error: 'toPosition must be different from fromPosition' });
    }

    const movedAtRaw = req.body?.movedAt;
    const movedAt = movedAtRaw ? new Date(movedAtRaw) : new Date();
    if (Number.isNaN(movedAt.getTime())) {
      return res.status(400).json({ error: 'movedAt is invalid' });
    }

    const km = Number.isFinite(Number(req.body?.km)) ? Number(req.body.km) : null;
    const hours = Number.isFinite(Number(req.body?.hours)) ? Number(req.body.hours) : null;

    const activeFrom = await prisma.tireMount.findFirst({
      where: { vehicleId: vehicle.id, position: fromPosition, unmountedAt: null },
      include: { tire: true }
    });
    if (!activeFrom) {
      return res.status(404).json({ error: 'No active mount in fromPosition' });
    }

    // Free destination position
    await prisma.tireMount.updateMany({
      where: { vehicleId: vehicle.id, position: toPosition, unmountedAt: null },
      data: { unmountedAt: movedAt, unmountedKm: km, unmountedHours: hours }
    });

    // Close from mount
    await prisma.tireMount.update({
      where: { id: activeFrom.id },
      data: { unmountedAt: movedAt, unmountedKm: km, unmountedHours: hours }
    });

    // Create new mount at destination
    const newMount = await prisma.tireMount.create({
      data: {
        tireId: activeFrom.tireId,
        vehicleId: vehicle.id,
        position: toPosition,
        mountedAt: movedAt,
        mountedKm: km,
        mountedHours: hours
      },
      include: { tire: true, vehicle: true }
    });

    await logAction(
      req.user?.id || null,
      'TIRE_MOVE',
      'TIRE_MOUNT',
      newMount.id,
      { vehicleId: vehicle.id, fromPosition, toPosition, marking: activeFrom.tire?.marking || null, movedAt },
      req.user?.email
    );

    res.json({ from: activeFrom, to: newMount });
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


// ============ TIRE INSPECTIONS BULK IMPORT ============

router.post('/tires/import-inspections', async (req, res) => {
  try {
    const inspections = req.body; // Array of mapped objects
    if (!Array.isArray(inspections)) {
      return res.status(400).json({ error: 'Expected an array of inspections' });
    }

    const results = {
      processed: 0,
      created: 0,
      errors: [],
      warnings: []
    };

    for (const row of inspections) {
      results.processed++;
      try {
        // 1. Resolve Vehicle
        let vehicle = await resolveVehicleByIdentifier(row.vehicleIdentifier); // plate or code
        if (!vehicle) {
          // Try to create if we have enough info, or fail
          // For now, fail as before, but maybe we can update it if it exists
          results.errors.push({ row, error: `Vehicle not found: ${row.vehicleIdentifier}` });
          continue;
        }

        // Update vehicle details if provided
        if (row.vehicleInternalCode || row.vehicleType || row.vehicleArea) {
           await prisma.vehicle.update({
             where: { id: vehicle.id },
             data: {
               internalCode: row.vehicleInternalCode || vehicle.internalCode,
               model: row.vehicleType || vehicle.model, // Map EQUIPO to model
               area: row.vehicleArea || vehicle.area
             }
           });
        }

        // 2. Resolve Tire (Create if not exists)
        const marking = String(row.tireMarking || '').trim().toUpperCase();
        if (!marking) {
          results.errors.push({ row, error: 'Missing tire marking' });
          continue;
        }

        let tire = await prisma.tire.findUnique({ where: { marking } });
        if (!tire) {
          tire = await prisma.tire.create({
            data: {
              marking,
              brand: row.brand || 'GENERIC',
              model: row.model || 'GENERIC',
              size: row.size || 'GENERIC',
              condition: row.condition || 'USED',
              application: row.application || null,
              originalDepth: row.originalDepth ? Number(row.originalDepth) : null
            }
          });
        } else {
          // Update existing tire with new info if available
          await prisma.tire.update({
            where: { id: tire.id },
            data: {
              brand: row.brand || tire.brand,
              model: row.model || tire.model,
              size: row.size || tire.dimension,
              condition: row.condition || tire.condition,
              application: row.application || tire.application,
              originalDepth: row.originalDepth ? Number(row.originalDepth) : tire.originalDepth
            }
          });
        }

        // 3. Handle Mount Logic (Ensure this tire is mounted at this position)
        const position = Number(row.position);
        const inspectionDate = row.inspectedAt ? new Date(row.inspectedAt) : new Date();
        
        if (!Number.isFinite(position)) {
           results.errors.push({ row, error: `Invalid position: ${row.position}` });
           continue;
        }

        // Check current mount at this position
        const currentMount = await prisma.tireMount.findFirst({
          where: {
            vehicleId: vehicle.id,
            position: position,
            unmountedAt: null
          },
          include: { tire: true }
        });

        let mountId = currentMount?.id;

        if (!currentMount) {
          // No tire mounted here -> Mount this one
          const newMount = await prisma.tireMount.create({
            data: {
              vehicleId: vehicle.id,
              tireId: tire.id,
              position: position,
              mountedAt: inspectionDate, // Assume mounted at inspection time if unknown
              mountedKm: row.odometerKm || 0
            }
          });
          mountId = newMount.id;
        } else if (currentMount.tire.marking !== marking) {
          // Different tire mounted -> Dismount old, Mount new
          await prisma.tireMount.update({
            where: { id: currentMount.id },
            data: { unmountedAt: inspectionDate, unmountedKm: row.odometerKm || 0 }
          });

          const newMount = await prisma.tireMount.create({
            data: {
              vehicleId: vehicle.id,
              tireId: tire.id,
              position: position,
              mountedAt: inspectionDate,
              mountedKm: row.odometerKm || 0
            }
          });
          mountId = newMount.id;
        }
        // If currentMount.tire.marking === marking, we are good.

        // 4. Create Inspection (Avoid duplicates if possible)
        // Check if inspection exists for this mount at this date (approx)
        const existingInsp = await prisma.tireInspection.findFirst({
          where: {
            mountId: mountId,
            inspectedAt: inspectionDate
          }
        });

        if (!existingInsp) {
          await prisma.tireInspection.create({
            data: {
              mountId: mountId,
              vehicleId: vehicle.id, // Denormalized for easier querying
              tireId: tire.id,       // Denormalized
              inspectedAt: inspectionDate,
              odometerKm: row.odometerKm ? Number(row.odometerKm) : null,
              psiCold: row.psiCold ? Number(row.psiCold) : null,
              depthExt: row.depthExt ? Number(row.depthExt) : null,
              depthCen: row.depthCen ? Number(row.depthCen) : null,
              depthInt: row.depthInt ? Number(row.depthInt) : null,
              remainingMm: row.remainingMm ? Number(row.remainingMm) : null,
              wearPct: row.wearPercent ? Number(row.wearPercent) : null,
              actionRotate: !!row.actionRotate,
              actionAlign: !!row.actionAlign,
              actionRemoveFromService: !!row.actionRemoveFromService,
              notes: row.notes || null,
              inspector: row.inspector || 'Imported'
            }
          });
          results.created++;
        } else {
           results.warnings.push({ row, warning: 'Inspection already exists for this date' });
        }

      } catch (e) {
        results.errors.push({ row, error: e.message });
      }
    }

    res.json(results);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
