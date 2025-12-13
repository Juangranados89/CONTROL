import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Car, 
  Wrench, 
  FileText, 
  Upload, 
  Plus, 
  Search, 
  AlertTriangle,
  CheckCircle,
  Menu,
  X,
  Calendar,
  ClipboardList,
  Database,
  PieChart,
  Clock,
  TrendingUp
} from 'lucide-react';
import { INITIAL_FLEET, MAINTENANCE_ROUTINES } from './data';

// --- Helper Functions ---

const getBase64ImageFromURL = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = error => reject(error);
    img.src = url;
  });
};

const getNextRoutine = (mileage, vehicleModel = '') => {
  let intervals = Object.keys(MAINTENANCE_ROUTINES).map(Number).sort((a, b) => a - b);

  // Filter intervals based on model availability
  if (vehicleModel) {
      const modelUpper = vehicleModel.toUpperCase();
      intervals = intervals.filter(interval => {
          const r = MAINTENANCE_ROUTINES[interval];
          if (modelUpper.includes('RAM')) return r.variants && r.variants['RAM'];
          if (modelUpper.includes('JMC')) return r.variants && r.variants['JMC'];
          return true; 
      });
  }

  // Find the first interval greater than current mileage
  const nextInterval = intervals.find(interval => interval > mileage);
  
  // Fallback if no higher interval is found (use the highest one)
  const targetInterval = nextInterval || intervals[intervals.length - 1];
  
  const baseRoutine = MAINTENANCE_ROUTINES[targetInterval] || { name: 'Mantenimiento Estándar', items: [], supplies: [], variants: {} };
  
  // Check for variants
  let finalRoutine = baseRoutine;
  if (vehicleModel) {
      const modelUpper = vehicleModel.toUpperCase();
      if (modelUpper.includes('RAM') && baseRoutine.variants?.['RAM']) {
          finalRoutine = baseRoutine.variants['RAM'];
      } else if (modelUpper.includes('JMC') && baseRoutine.variants?.['JMC']) {
          finalRoutine = baseRoutine.variants['JMC'];
      }
  }

  return {
    km: targetInterval,
    ...finalRoutine
  };
};

const generateTaskCode = (description) => {
  const upperDesc = description.toUpperCase();
  
  // Specific mappings based on common tasks
  if (upperDesc.includes("ACEITE DE MOTOR") && upperDesc.includes("CAMBIAR")) return "CAMB-ACMOT";
  if (upperDesc.includes("ACEITE DE LA TRANSMISION") && upperDesc.includes("CAMBIAR")) return "CAMB-ACTRA";
  if (upperDesc.includes("FILTRO DE ACEITE") && upperDesc.includes("CAMBIAR")) return "CAMB-FLMOT";
  if (upperDesc.includes("FILTRO DE COMBUSTIBLE") && upperDesc.includes("CAMBIAR")) return "CAMB-FCOMB";
  if (upperDesc.includes("FILTRO DE AIRE") && upperDesc.includes("CAMBIAR")) return "CAMB-FAIRE";
  if (upperDesc.includes("FILTRO DE AIRE ACONDICIONADO")) return "CAMB-FAIREAC";
  if (upperDesc.includes("TANQUE DE COMBUSTIBLE") && (upperDesc.includes("LIMPIEZA") || upperDesc.includes("LAVADO"))) return "LIMP-TQCMB";
  if (upperDesc.includes("ESTRUCTURA DE LA EMBARCACION")) return "REV-ESEMB"; // Kept for compatibility
  if (upperDesc.includes("ESTADO DEL MOTOR")) return "REV-MOT";
  if (upperDesc.includes("SWICHT DE ENCENDIDO")) return "REV-SWICHT";
  if (upperDesc.includes("CORREAS")) return "REV-AJCORR";
  if (upperDesc.includes("BATERIAS")) return "REV-BAT";
  if (upperDesc.includes("SISTEMA DE ARRANQUE")) return "REV-ARRNQ";
  if (upperDesc.includes("TABLERO")) return "REV-CABTC";
  if (upperDesc.includes("FRENOS") && upperDesc.includes("LIQUIDO")) return "CAMB-LQFRN";
  if (upperDesc.includes("REFRIGERANTE")) return "REV-NIVREF";
  if (upperDesc.includes("DIRECCION") && upperDesc.includes("ACEITE")) return "REV-NIVDIR";
  if (upperDesc.includes("SISTEMA DE FRENOS")) return "REV-SISFRN";
  if (upperDesc.includes("PASTILLAS DE FRENO")) return "REV-PSTFRN";
  if (upperDesc.includes("DISCOS DE FRENO")) return "REV-DSCFRN";
  if (upperDesc.includes("AMORTIGUADORES")) return "REV-AMORT";
  if (upperDesc.includes("LLANTAS")) return "REV-LLANT";
  if (upperDesc.includes("LUCES")) return "REV-LUCES";
  
  // Generic fallback generator
  const words = upperDesc.split(' ');
  const action = words[0].substring(0, 4); // CAMB, REV, LIMP
  const object = words.slice(1).map(w => w[0]).join('').substring(0, 5);
  return `${action}-${object}`;
};

const generatePDF = async (workOrder) => {
  if (!window.jspdf) {
    alert("La librería jsPDF no está cargada.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // --- HEADER (Boxed Layout) ---
  const startX = 10;
  const startY = 10;
  const headerHeight = 30;
  const fullWidth = 190;
  
  // Main Header Box
  doc.setDrawColor(0);
  doc.setLineWidth(0.1);
  doc.rect(startX, startY, fullWidth, headerHeight); // Outer border

  // Vertical Dividers
  doc.line(startX + 60, startY, startX + 60, startY + headerHeight); // Logo separator (Widened to 60)
  doc.line(startX + 140, startY, startX + 140, startY + headerHeight); // Title separator

  // Logo
  try {
    const logoBase64 = await getBase64ImageFromURL('/logo.png');
    // Centering logo: Box width 60, Image width 40 -> Margin X = 10
    // Box height 30, Image height 27 -> Margin Y = 1.5
    doc.addImage(logoBase64, 'PNG', startX + 10, startY + 1.5, 40, 27); 
  } catch (e) {
    console.error("Error loading logo:", e);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0); // Ensure black
    doc.text("GRUPORTIZ", startX + 30, startY + 15, { align: 'center' });
  }

  // Title Text
  doc.setFont("helvetica", "bold"); // Helvetica is standard sans-serif (like Arial)
  doc.setTextColor(0, 0, 0); // Ensure black
  doc.setFontSize(10);
  const titleCenterX = startX + 60 + (80 / 2); // Adjusted center for new width
  doc.text("FORMATO EJECUCION", titleCenterX, startY + 10, { align: 'center' });
  doc.text("MANTENIMIENTO PREVENTIVOS", titleCenterX, startY + 15, { align: 'center' });
  doc.text("VEHICULOS LIVIANOS (CAMIONETAS)", titleCenterX, startY + 20, { align: 'center' });

  // OT Info (Right Box)
  // Horizontal Divider for OT Box
  doc.line(startX + 140, startY + 15, startX + fullWidth, startY + 15);

  // Top part: OT Consecutivo
  doc.setFontSize(8);
  doc.text("OT CONSECUTIVO", startX + 140 + 25, startY + 5, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0); // Black color for number (was red)
  doc.text(String(workOrder.id), startX + 140 + 25, startY + 12, { align: 'center' });
  
  // Bottom part: Codigo Formato
  doc.setFontSize(8);
  doc.text("CÓDIGO FORMATO", startX + 140 + 25, startY + 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text("F-MTO-001", startX + 140 + 25, startY + 26, { align: 'center' });


  // --- GENERAL INFO (Grid Layout) ---
  const infoStartY = startY + headerHeight + 5; // Spacing after header

  const infoData = [
    ['CENTRO OPERACION', '40BU-TRONCALES', 'AREA OPERATIVA', 'SST'],
    ['PROCESO', 'MTTO-PREVENTIVO', 'UBICACION', 'TALLER EL HATO'],
    ['ACTIVO', workOrder.vehicleCode || workOrder.vehicleModel, 'PLACA', workOrder.plate],
    ['FUNCION', 'TRANSPORTE DE PERSONAL', 'TIPO OT', 'S'],
    ['DESCRIPCION CORTA', workOrder.vehicleModel, 'NO. SERIE', ''], 
    ['TRABAJO A REALIZAR', workOrder.routineName, 'APROBADA', ''],
    ['FECHA SOLICITUD', new Date().toLocaleDateString(), 'HORA SOLICITUD', '02:00 p.m.'], 
    ['FECHA REAL EJECUCION', '', 'HORA REAL EJECUCION', ''],
    ['VARIABLE PROGRAMADA', `${workOrder.mileage}`, 'VARIABLE EJECUTADA', ''],
    ['GENERADA POR', 'CDMT', 'PLANEADOR', 'PLANEADOR:'],
    ['TIPO DE PARO', 'PRO', 'REPORTO', '']
  ];

  doc.autoTable({
    startY: infoStartY,
    head: [],
    body: infoData,
    theme: 'grid', // Grid theme gives borders
    styles: { 
      font: "helvetica", // Ensure font is Helvetica (Arial-like)
      fontSize: 7, 
      cellPadding: 1.5, 
      lineColor: 0, 
      lineWidth: 0.1,
      textColor: 0 // Black text
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, fillColor: [240, 240, 240] }, // Label col 1
      1: { cellWidth: 60 }, // Value col 1
      2: { fontStyle: 'bold', cellWidth: 35, fillColor: [240, 240, 240] }, // Label col 2
      3: { cellWidth: 60 }  // Value col 2
    },
    margin: { left: 10, right: 10 }
  });

  // --- TAREAS REALIZADAS ---
  // Get the Y position where the previous table ended
  const finalY = doc.lastAutoTable.finalY + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TAREAS REALIZADAS", 10, finalY);
  
  doc.autoTable({
    startY: finalY + 2,
    head: [['CODIGO', 'DESCRIPCION', 'SISTEMA', 'EJECUCION']],
    body: workOrder.items.map(item => [
      generateTaskCode(item.description), 
      item.description, 
      item.type === 'Preventivo' ? 'SISTEMA MOTOR' : 'INSPECCION',
      '[ ] OK   [ ] NO'
    ]),
    theme: 'grid',
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5, lineColor: 0, lineWidth: 0.1, textColor: 0 },
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 95 },
      2: { cellWidth: 40 },
      3: { cellWidth: 30, halign: 'center' }
    },
    margin: { left: 10, right: 10 }
  });

  // REPUESTOS Table
  const repuestosY = doc.lastAutoTable.finalY + 10;
  doc.text("REPUESTOS / MATERIALES UTILIZADOS", 14, repuestosY);
  
  doc.autoTable({
    startY: repuestosY + 3,
    head: [['FECHA', 'BODEGA', 'REPUESTO', 'DESCRIPCION', 'UND', 'CANT', 'VL. TOTAL']],
    body: workOrder.supplies.map(s => [
      new Date().toLocaleDateString(),
      'BODEGA',
      s.reference || '---',
      s.name || s,
      'UND',
      s.quantity || '1',
      ''
    ]),
    theme: 'grid',
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5, lineColor: 0, lineWidth: 0.1, textColor: 0 },
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 
      0: {halign: 'center'}, 
      1: {halign: 'center'}, 
      2: {halign: 'left'}, 
      3: {halign: 'left'}, 
      4: {halign: 'center'}, 
      5: {halign: 'center'}, 
      6: {halign: 'center'} 
    },
    margin: { left: 10, right: 10 }
  });

  // Signatures
  let sigY = doc.lastAutoTable.finalY + 15;
  if (sigY > 250) { doc.addPage(); sigY = 20; }

  doc.rect(10, sigY, 60, 20); 
  doc.rect(70, sigY, 60, 20); 
  doc.rect(130, sigY, 70, 20); 
  
  doc.setFontSize(6);
  doc.text("RESPONSABLE", 12, sigY + 4);
  doc.text("APROBADOR", 72, sigY + 4);
  doc.text("RECIBE A SATISFACCION", 132, sigY + 4);

  doc.save(`OT-${workOrder.id}-${workOrder.plate}.pdf`);
};

// --- Components ---

const PlanningView = ({ fleet, setFleet, onCreateOT, workOrders = [], setWorkOrders, variableHistory = [], routines = MAINTENANCE_ROUTINES }) => {
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [workshop, setWorkshop] = useState('');
  const [viewingHistoryVehicle, setViewingHistoryVehicle] = useState(null);
  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);
  const [showManualUpdate, setShowManualUpdate] = useState(false);
  const [showBulkLoad, setShowBulkLoad] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [manualData, setManualData] = useState({ code: '', plate: '', lastDate: '', lastKm: '' });
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, VENCIDO, PROXIMO, OK

  const handleBulkLoad = () => {
    const rows = bulkData.trim().split('\n');
    const newFleet = [...fleet];
    let updatesCount = 0;

    rows.forEach(row => {
      const cols = row.split(/\t/);
      if (cols.length < 9) return; // Need at least 9 columns

      // #INTERNO | PLACA | DESCRIPCION | FRECUENCIA | CLASE | MARCA | UBICACIÓN | FECHA ACT. | HR ULTIMA EJEC. | FECHA ULTIMA EJEC.
      // Index:  0       1            2            3         4       5          6             7                 8                    9
      const code = cols[0]?.trim();
      const plate = cols[1]?.trim();
      const lastExecValRaw = cols[8]?.trim(); // HR ULTIMA EJECUCION (índice 8)
      const lastExecDateRaw = cols[9]?.trim(); // FECHA ULTIMA EJECUCION (índice 9)

      if (!code && !plate) return;

      // Search by code OR plate
      const vehicleIndex = newFleet.findIndex(v => 
        (code && v.code.toUpperCase() === code.toUpperCase()) || 
        (plate && v.plate.toUpperCase() === plate.toUpperCase())
      );
      
      if (vehicleIndex !== -1) {
        const lastExecVal = parseInt(lastExecValRaw?.replace(/,/g, '').replace(/\./g, '')) || 0;
        
        // Parse date (handles DD/MM/YYYY format)
        let lastExecDate = null;
        if (lastExecDateRaw && lastExecDateRaw !== '#N/D') {
          const dateParts = lastExecDateRaw.split('/');
          if (dateParts.length === 3) {
            // Convert DD/MM/YYYY to YYYY-MM-DD
            lastExecDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
          }
        }
        
        if (lastExecVal > 0) {
          newFleet[vehicleIndex] = {
            ...newFleet[vehicleIndex],
            lastMaintenance: lastExecVal,
            lastMaintenanceDate: lastExecDate // Store the date too
          };
          updatesCount++;
        }
      }
    });

    setFleet(newFleet);
    alert(`Se actualizaron ${updatesCount} vehículos con información de último mantenimiento.`);
    setShowBulkLoad(false);
    setBulkData('');
  };

  // Helper to get next routine using the passed routines prop
  const getNextRoutineLocal = (mileage, vehicleModel = '', lastMaintenance = 0) => {
    let intervals = Object.keys(routines).map(Number).sort((a, b) => a - b);

    // Filter intervals based on model availability
    if (vehicleModel) {
        const modelUpper = vehicleModel.toUpperCase();
        intervals = intervals.filter(interval => {
            const r = routines[interval];
            if (modelUpper.includes('RAM')) return r.variants && r.variants['RAM'];
            if (modelUpper.includes('JMC')) return r.variants && r.variants['JMC'];
            return true; 
        });
    }

    if (intervals.length === 0) return { km: 5000, name: 'Mantenimiento Estándar', items: [], supplies: [] };

    const cycle = intervals[0]; // Assume smallest interval is the cycle (e.g. 5000 or 7000)
    let targetKm;

    // 1. Calculate Target KM
    if (lastMaintenance > 0) {
        // If we have last maintenance, next is Last + Cycle
        targetKm = lastMaintenance + cycle;
        
        // Logic to prevent "High Negatives" (e.g. Last=100k, Current=236k -> Target=107k -> Remaining=-129k)
        // If the calculated target is way behind current mileage (more than 1 cycle),
        // we assume the schedule should "catch up" to the current mileage.
        // We find the most recent standard interval that was passed.
        if (targetKm < mileage - cycle) {
             // Snap to the nearest previous multiple of cycle
             targetKm = Math.floor(mileage / cycle) * cycle;
        }
    } else {
        // No history: Find next interval > mileage
        const next = intervals.find(interval => interval > mileage);
        if (next) {
            targetKm = next;
        } else {
            // Mileage exceeds all defined intervals: Calculate next multiple
            targetKm = Math.ceil((mileage + 1) / cycle) * cycle;
        }
    }
    
    // 2. Find Routine Definition (Content)
    // Try exact match first
    let baseRoutine = routines[targetKm];
    
    // If exact match not found (e.g. targetKm = 245,000 but routines only go to 120,000)
    if (!baseRoutine) {
        // Fallback logic:
        // Try to find a matching cycle in the defined intervals
        // For now, we'll default to the basic cycle routine (e.g. 5000 or 7000) 
        // assuming it's a standard maintenance.
        const fallbackRoutine = routines[cycle] || { name: 'Mantenimiento Estándar', items: [], supplies: [], variants: {} };
        // Clone and rename to reflect the actual target KM
        baseRoutine = { 
            ...fallbackRoutine,
            name: `Mantenimiento ${targetKm.toLocaleString()} KM`
        };
    }
    
    // Check for variants (RAM/JMC)
    let finalRoutine = baseRoutine;
    if (vehicleModel) {
        const modelUpper = vehicleModel.toUpperCase();
        if (modelUpper.includes('RAM') && baseRoutine.variants?.['RAM']) {
            finalRoutine = baseRoutine.variants['RAM'];
        } else if (modelUpper.includes('JMC') && baseRoutine.variants?.['JMC']) {
            finalRoutine = baseRoutine.variants['JMC'];
        }
    }

    return {
      km: targetKm,
      ...finalRoutine
    };
  };

  // Filter for Pickups (Camionetas) - PVHC or Model containing "Camioneta"
  const pickups = useMemo(() => {
    return fleet.filter(v => 
      v.code.startsWith('PVHC') || 
      v.model.toUpperCase().includes('CAMIONETA')
    );
  }, [fleet]);

  const handleQuickGenerateClick = (e, vehicle) => {
    e.stopPropagation(); // Prevent row click
    setSelectedVehicle(vehicle);
    setWorkshop('TALLER EL HATO'); // Default
  };

  const confirmGeneration = () => {
    if (!selectedVehicle) return;
    
    const routine = getNextRoutineLocal(selectedVehicle.mileage, selectedVehicle.model, selectedVehicle.lastMaintenance);
    
    // Generate consecutive ID
    const maxId = workOrders.length > 0 
      ? Math.max(...workOrders.map(ot => ot.id)) 
      : 1000;
    const newId = maxId + 1;

    const workOrder = {
      id: newId,
      vehicleCode: selectedVehicle.code,
      vehicleModel: selectedVehicle.model,
      plate: selectedVehicle.plate,
      routineName: `MANTENIMIENTO PREVENTIVO ${routine.km} KM`,
      mileage: selectedVehicle.mileage,
      items: routine.items || [],
      supplies: routine.supplies || [],
      workshop: workshop,
      status: 'ABIERTA',
      creationDate: new Date().toISOString().split('T')[0]
    };

    // 1. Create OT in system
    onCreateOT(workOrder);
    
    // 2. Generate PDF
    generatePDF(workOrder);

    // 3. Reset
    setSelectedVehicle(null);
    setWorkshop('');
  };

  const getVehicleHistory = (vehicle) => {
    return workOrders.filter(ot => 
      ot.vehicleCode === vehicle.code || ot.plate === vehicle.plate
    ).sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
  };

  const getLastVariableDate = (vehicle) => {
    // Try to find in history
    const history = variableHistory
      .filter(h => h.code === vehicle.code || h.plate === vehicle.plate)
      .sort((a, b) => new Date(b.date || b.uploadDate) - new Date(a.date || a.uploadDate));
    
    if (history.length > 0) return history[0].date || history[0].uploadDate?.split('T')[0];
    return new Date().toISOString().split('T')[0]; // Default to today/initial
  };

  const getLastMaintenanceDate = (vehicle) => {
    // First check if we have it from bulk load
    if (vehicle.lastMaintenanceDate) {
      return vehicle.lastMaintenanceDate;
    }
    
    // Fallback: Check closed OTs
    const closedOTs = workOrders
      .filter(ot => (ot.vehicleCode === vehicle.code || ot.plate === vehicle.plate) && ot.status === 'CERRADA')
      .sort((a, b) => new Date(b.closingDate) - new Date(a.closingDate));
    
    if (closedOTs.length > 0) return closedOTs[0].closingDate;
    return "---";
  };

  const weeklyPlan = useMemo(() => {
    // 1. Identify candidates (Remaining < 3000km or Vencido)
    const candidates = pickups.map(v => {
        const next = getNextRoutineLocal(v.mileage, v.model, v.lastMaintenance);
        return { ...v, nextRoutine: next, remaining: next.km - v.mileage };
    }).filter(v => v.remaining < 3000);

    // 2. Distribute Mon-Fri
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const plan = { Lunes: [], Martes: [], Miércoles: [], Jueves: [], Viernes: [] };
    
    candidates.forEach((v, i) => {
        const dayIndex = i % 5; 
        plan[days[dayIndex]].push(v);
    });
    
    return plan;
  }, [pickups, routines]);

  const handleManualUpdateSubmit = () => {
    const { code, plate, lastDate, lastKm } = manualData;
    if (!code && !plate) return alert('Debe ingresar Placa o Código para identificar el vehículo');
    
    // Find vehicle
    const vehicleIndex = fleet.findIndex(v => 
      (code && v.code.toUpperCase() === code.toUpperCase()) || (plate && v.plate.toUpperCase() === plate.toUpperCase())
    );

    if (vehicleIndex === -1) return alert('Vehículo no encontrado en la flota');
    const vehicle = fleet[vehicleIndex];

    // 1. Update Fleet Mileage if provided
    if (lastKm) {
      const newFleet = [...fleet];
      newFleet[vehicleIndex] = { ...vehicle, mileage: parseInt(lastKm) };
      if (setFleet) setFleet(newFleet);
    }

    // 2. Create Historical OT if date provided
    if (lastDate) {
      const newOT = {
        id: Math.floor(Math.random() * 10000) + 90000, // High ID for manual
        vehicleCode: vehicle.code,
        vehicleModel: vehicle.model,
        plate: vehicle.plate,
        routineName: `MANTENIMIENTO REGISTRADO MANUALMENTE (${lastKm || vehicle.mileage} KM)`,
        mileage: lastKm || vehicle.mileage,
        items: [],
        supplies: [],
        workshop: 'EXTERNO (HISTÓRICO)',
        status: 'CERRADA',
        creationDate: lastDate,
        closingDate: lastDate
      };
      if (setWorkOrders) setWorkOrders(prev => [newOT, ...prev]);
    }

    setShowManualUpdate(false);
    setManualData({ code: '', plate: '', lastDate: '', lastKm: '' });
    alert('Datos actualizados correctamente');
  };

  return (
    <div className="p-6 space-y-6 relative">
      {/* Modal for Manual Update */}
      {showManualUpdate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Upload size={20} className="text-blue-600"/> Cargar Datos Históricos
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Actualice manualmente el último mantenimiento conocido.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Código Interno</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded text-sm"
                  placeholder="Ej: PVHC001"
                  value={manualData.code}
                  onChange={e => setManualData({...manualData, code: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Placa</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded text-sm"
                  placeholder="Ej: ABC-123"
                  value={manualData.plate}
                  onChange={e => setManualData({...manualData, plate: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Último Mtto</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border rounded text-sm"
                    value={manualData.lastDate}
                    onChange={e => setManualData({...manualData, lastDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">KM Último Mtto</label>
                  <input 
                    type="number" 
                    className="w-full p-2 border rounded text-sm"
                    placeholder="KM"
                    value={manualData.lastKm}
                    onChange={e => setManualData({...manualData, lastKm: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => setShowManualUpdate(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleManualUpdateSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Bulk Load (Plan) */}
      {showBulkLoad && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[700px]">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Database size={20} className="text-blue-600"/> Carga Masiva de Plan (Último Mantenimiento)
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Pegue la tabla de Excel con las columnas (10 columnas):<br/>
              <strong>#INTERNO | PLACA | DESCRIPCION | FRECUENCIA | CLASE | MARCA | UBICACIÓN | FECHA ACT. | HR ULTIMA EJEC. | FECHA ULTIMA EJEC.</strong>
            </p>
            
            <textarea 
              className="w-full h-64 p-4 border rounded-lg font-mono text-xs bg-slate-50 whitespace-pre mb-4"
              placeholder={`PVHC001\tKFZ321\tCAMIONETA DOBLE CABINA\t5000\tKM\tToyota Hilux\tMAQUINARIA\t10/12/2025\t231200\t18/11/2025`}
              value={bulkData}
              onChange={e => setBulkData(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowBulkLoad(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleBulkLoad}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm"
              >
                Procesar y Actualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Workshop Selection */}
      {selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">Confirmar Generación de OT</h3>
            <p className="text-sm text-slate-600 mb-4">
              Vas a generar una OT para el vehículo <strong>{selectedVehicle.plate}</strong>.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Taller de Ejecución</label>
              <select 
                className="w-full p-2 border rounded"
                value={workshop}
                onChange={(e) => setWorkshop(e.target.value)}
              >
                <option value="TALLER EL HATO">TALLER EL HATO</option>
                <option value="TALLER CENTRAL">TALLER CENTRAL</option>
                <option value="EXTERNO">TALLER EXTERNO</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setSelectedVehicle(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmGeneration}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
              >
                Confirmar y Generar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Weekly Plan */}
      {showWeeklyPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[90vw] max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="text-blue-600" /> Planeación Semanal Sugerida
                </h3>
                <p className="text-sm text-slate-500">Distribución automática basada en prioridad (KM Restante)</p>
              </div>
              <button onClick={() => setShowWeeklyPlan(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto grid grid-cols-5 gap-4">
              {Object.entries(weeklyPlan).map(([day, vehicles]) => (
                <div key={day} className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex flex-col">
                  <h4 className="font-bold text-center text-slate-700 mb-4 border-b pb-2">{day}</h4>
                  <div className="space-y-3 flex-1">
                    {vehicles.length > 0 ? vehicles.map(v => (
                      <div key={v.id} className="bg-white p-3 rounded shadow-sm border-l-4 border-blue-500">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-sm">{v.plate}</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${v.remaining < 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {v.remaining} km
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{v.nextRoutine.name}</div>
                        <button 
                          onClick={(e) => handleQuickGenerateClick(e, v)}
                          className="mt-2 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded w-full hover:bg-blue-100"
                        >
                          Generar OT
                        </button>
                      </div>
                    )) : (
                      <div className="text-center text-slate-400 text-xs italic py-4">Sin asignaciones</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal for Vehicle History */}
      {viewingHistoryVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <div>
                <h3 className="text-lg font-bold">Historial de Mantenimiento</h3>
                <p className="text-sm text-slate-500">{viewingHistoryVehicle.plate} - {viewingHistoryVehicle.model}</p>
              </div>
              <button onClick={() => setViewingHistoryVehicle(null)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {getVehicleHistory(viewingHistoryVehicle).length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-2">Fecha</th>
                      <th className="p-2">OT #</th>
                      <th className="p-2">Rutina</th>
                      <th className="p-2">Estado</th>
                      <th className="p-2">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {getVehicleHistory(viewingHistoryVehicle).map(ot => (
                      <tr key={ot.id}>
                        <td className="p-2">{ot.creationDate}</td>
                        <td className="p-2 font-mono text-blue-600">#{ot.id}</td>
                        <td className="p-2">{ot.routineName}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            ot.status === 'ABIERTA' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {ot.status}
                          </span>
                        </td>
                        <td className="p-2">
                          <button 
                            onClick={() => generatePDF(ot)}
                            className="text-slate-600 hover:text-blue-600"
                            title="Descargar PDF"
                          >
                            <FileText size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-slate-400 italic">
                  No hay historial de órdenes para este vehículo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="text-blue-600" />
            Planeación de Mantenimientos (Camionetas)
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowManualUpdate(true)}
              className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded hover:bg-slate-50 text-sm flex items-center gap-2 shadow-sm"
            >
              <Upload size={16} /> Cargar Datos Mtto
            </button>
            <button 
              onClick={() => setShowBulkLoad(true)}
              className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded hover:bg-slate-50 text-sm flex items-center gap-2 shadow-sm"
            >
              <Database size={16} /> Carga Masiva Plan
            </button>
            <button 
              onClick={() => setShowWeeklyPlan(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm flex items-center gap-2 shadow-sm"
            >
              <Calendar size={16} /> Planeación Semanal
            </button>
            <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm flex items-center gap-2 shadow-sm">
              <FileText size={16} /> Exportar Excel
            </button>
          </div>
        </div>

        {/* Mini Metrics Cards */}
        {(() => {
          // Calculate metrics
          const today = new Date();
          const fiveDaysAgo = new Date(today);
          fiveDaysAgo.setDate(today.getDate() - 5);
          
          const metrics = pickups.reduce((acc, v) => {
            const nextRoutine = getNextRoutineLocal(v.mileage, v.model, v.lastMaintenance);
            const kmRemaining = nextRoutine.km - v.mileage;
            
            // Check if variable is outdated (more than 3 days old)
            const lastVarDate = getLastVariableDate(v);
            const varDate = new Date(lastVarDate);
            const isOutdated = varDate < fiveDaysAgo || v.mileage === 0;
            
            if (isOutdated) acc.outdated++;
            if (kmRemaining < 0) acc.overdue++;
            else if (kmRemaining < 1000) acc.upcoming++;
            else if (kmRemaining < 3000) acc.inRange++;
            else acc.ok++;
            
            return acc;
          }, { outdated: 0, overdue: 0, upcoming: 0, inRange: 0, ok: 0 });

          return (
            <div className="grid grid-cols-5 gap-3">
              {/* Sin Actualizar */}
              <div 
                onClick={() => setStatusFilter('OUTDATED')}
                className={`bg-white rounded-xl p-4 shadow-sm border-2 cursor-pointer transition-all hover:shadow-md ${statusFilter === 'OUTDATED' ? 'border-purple-500 ring-2 ring-purple-200' : 'border-slate-200 hover:border-purple-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Sin Actualizar</p>
                    <p className="text-2xl font-black text-purple-600">{metrics.outdated}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <AlertTriangle size={20} className="text-purple-600" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Variable &gt;5 días o sin datos</p>
              </div>

              {/* Vencidos */}
              <div 
                onClick={() => setStatusFilter('VENCIDO')}
                className={`bg-white rounded-xl p-4 shadow-sm border-2 cursor-pointer transition-all hover:shadow-md ${statusFilter === 'VENCIDO' ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 hover:border-red-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Vencidos</p>
                    <p className="text-2xl font-black text-red-600">{metrics.overdue}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle size={20} className="text-red-600" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Mtto. pasado</p>
              </div>

              {/* Próximos */}
              <div 
                onClick={() => setStatusFilter('PROXIMO')}
                className={`bg-white rounded-xl p-4 shadow-sm border-2 cursor-pointer transition-all hover:shadow-md ${statusFilter === 'PROXIMO' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-200 hover:border-amber-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Próximos</p>
                    <p className="text-2xl font-black text-amber-600">{metrics.upcoming}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Clock size={20} className="text-amber-600" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">&lt;1,000 KM restantes</p>
              </div>

              {/* En Rango */}
              <div 
                onClick={() => setStatusFilter('INRANGE')}
                className={`bg-white rounded-xl p-4 shadow-sm border-2 cursor-pointer transition-all hover:shadow-md ${statusFilter === 'INRANGE' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-blue-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">En Rango</p>
                    <p className="text-2xl font-black text-blue-600">{metrics.inRange}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <TrendingUp size={20} className="text-blue-600" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">1,000 - 3,000 KM</p>
              </div>

              {/* Al Día */}
              <div 
                onClick={() => setStatusFilter('OK')}
                className={`bg-white rounded-xl p-4 shadow-sm border-2 cursor-pointer transition-all hover:shadow-md ${statusFilter === 'OK' ? 'border-green-500 ring-2 ring-green-200' : 'border-slate-200 hover:border-green-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Al Día</p>
                    <p className="text-2xl font-black text-green-600">{metrics.ok}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle size={20} className="text-green-600" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">&gt;3,000 KM restantes</p>
              </div>
            </div>
          );
        })()}

        {/* Filter Buttons Row */}
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
            <button 
              onClick={() => setStatusFilter('ALL')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Todos ({pickups.length})
            </button>
          </div>
          
          {statusFilter !== 'ALL' && (
            <button 
              onClick={() => setStatusFilter('ALL')}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <X size={14} /> Limpiar filtro
            </button>
          )}
        </div>
      </div>

      {/* Clean Minimal Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-sm border-collapse">
            {/* Clean Header */}
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold w-24 border-r border-slate-100">Estado</th>
                <th className="px-4 py-3 text-right font-semibold w-20 border-r border-slate-100">Falta</th>
                <th className="px-4 py-3 text-left font-semibold border-r border-slate-100">Código</th>
                <th className="px-4 py-3 text-left font-semibold border-r border-slate-100">Placa</th>
                <th className="px-4 py-3 text-left font-semibold border-r border-slate-100">Modelo</th>
                <th className="px-4 py-3 text-right font-semibold border-r border-slate-100">Variable</th>
                <th className="px-4 py-3 text-center font-semibold border-r border-slate-100">F. Variable</th>
                <th className="px-4 py-3 text-right font-semibold border-r border-slate-100">Últ. Mtto</th>
                <th className="px-4 py-3 text-center font-semibold border-r border-slate-100">F. Últ. Mtto</th>
                <th className="px-4 py-3 text-right font-semibold border-r border-slate-100">Próx. Rutina</th>
                <th className="px-4 py-3 text-center font-semibold w-28">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pickups
                .map(vehicle => {
                  const nextRoutine = getNextRoutineLocal(vehicle.mileage, vehicle.model, vehicle.lastMaintenance);
                  const kmRemaining = nextRoutine.km - vehicle.mileage;
                  
                  // Check if variable is outdated
                  const today = new Date();
                  const fiveDaysAgo = new Date(today);
                  fiveDaysAgo.setDate(today.getDate() - 5);
                  const lastVarDate = getLastVariableDate(vehicle);
                  const varDate = new Date(lastVarDate);
                  const isOutdated = varDate < fiveDaysAgo || vehicle.mileage === 0;
                  
                  return { ...vehicle, nextRoutine, kmRemaining, isOutdated };
                })
                .filter(vehicle => {
                  if (statusFilter === 'ALL') return true;
                  if (statusFilter === 'OUTDATED') return vehicle.isOutdated;
                  if (statusFilter === 'VENCIDO') return vehicle.kmRemaining < 0;
                  if (statusFilter === 'PROXIMO') return vehicle.kmRemaining >= 0 && vehicle.kmRemaining < 1000;
                  if (statusFilter === 'INRANGE') return vehicle.kmRemaining >= 1000 && vehicle.kmRemaining < 3000;
                  if (statusFilter === 'OK') return vehicle.kmRemaining >= 3000;
                  return true;
                })
                .sort((a, b) => a.kmRemaining - b.kmRemaining)
                .map((vehicle, index) => {
                  const { nextRoutine, kmRemaining, isOutdated } = vehicle;
                  
                  // Minimal status styling
                  let statusColor = "text-emerald-600 bg-emerald-50";
                  let statusText = "OK";
                  let faltaColor = "text-emerald-600";
                  
                  if (kmRemaining < 0) {
                    statusColor = "text-red-600 bg-red-50";
                    statusText = "VENCIDO";
                    faltaColor = "text-red-600";
                  } else if (kmRemaining < 1000) {
                    statusColor = "text-amber-600 bg-amber-50";
                    statusText = "PRÓXIMO";
                    faltaColor = "text-amber-600";
                  } else if (kmRemaining < 3000) {
                    statusColor = "text-blue-600 bg-blue-50";
                    statusText = "EN RANGO";
                    faltaColor = "text-blue-600";
                  }

                  return (
                    <tr 
                      key={vehicle.id} 
                      className="hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100"
                      onClick={() => setViewingHistoryVehicle(vehicle)}
                    >
                      {/* Estado */}
                      <td className="px-4 py-3 border-r border-slate-100">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-semibold ${statusColor}`}>
                            {statusText}
                          </span>
                          {isOutdated && (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-medium text-purple-600 bg-purple-50">
                              Sin Act.
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Falta KM */}
                      <td className={`px-4 py-3 border-r border-slate-100 ${faltaColor}`}>
                        <div className="flex items-center justify-end gap-1.5">
                          {kmRemaining < 0 && <X size={14} className="text-red-500" />}
                          {kmRemaining >= 0 && kmRemaining < 1000 && <AlertTriangle size={14} className="text-amber-500" />}
                          {kmRemaining >= 1000 && kmRemaining < 3000 && <Clock size={14} className="text-blue-500" />}
                          {kmRemaining >= 3000 && <CheckCircle size={14} className="text-emerald-500" />}
                          <span className="font-mono font-bold">{kmRemaining.toLocaleString()}</span>
                        </div>
                      </td>
                      
                      {/* Código */}
                      <td className="px-4 py-3 border-r border-slate-100">
                        <span className="font-mono text-slate-600">{vehicle.code}</span>
                      </td>
                      
                      {/* Placa */}
                      <td className="px-4 py-3 font-semibold text-slate-800 border-r border-slate-100">
                        {vehicle.plate}
                      </td>
                      
                      {/* Modelo */}
                      <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[180px] border-r border-slate-100" title={vehicle.model}>
                        {vehicle.model}
                      </td>
                      
                      {/* Variable Actual */}
                      <td className="px-4 py-3 text-right font-mono text-slate-700 border-r border-slate-100">
                        {vehicle.mileage.toLocaleString()}
                      </td>
                      
                      {/* Fecha Variable */}
                      <td className="px-4 py-3 text-center text-slate-400 text-xs border-r border-slate-100">
                        {getLastVariableDate(vehicle)}
                      </td>
                      
                      {/* Último Mtto KM */}
                      <td className="px-4 py-3 text-right font-mono text-slate-500 border-r border-slate-100">
                        {vehicle.lastMaintenance > 0 ? vehicle.lastMaintenance.toLocaleString() : '—'}
                      </td>
                      
                      {/* Fecha Último Mtto */}
                      <td className="px-4 py-3 text-center text-slate-400 text-xs border-r border-slate-100">
                        {getLastMaintenanceDate(vehicle)}
                      </td>
                      
                      {/* Próxima Rutina */}
                      <td className="px-4 py-3 text-right border-r border-slate-100">
                        <div className="font-mono font-semibold text-slate-700">{nextRoutine.km.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[100px]" title={nextRoutine.name}>
                          {nextRoutine.name}
                        </div>
                      </td>
                      
                      {/* Acción */}
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={(e) => handleQuickGenerateClick(e, vehicle)}
                          className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-slate-700 transition-colors"
                        >
                          Generar OT
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        
        {/* Minimal Footer */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400"></span> Vencido
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Próximo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span> En Rango
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> OK
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span> Sin Act.
            </span>
          </div>
          <span>Total: {pickups.length} camionetas</span>
        </div>
      </div>
    </div>
  );
};

const RoutinesManager = ({ routines, setRoutines }) => {
  const [selectedRoutineKey, setSelectedRoutineKey] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editData, setEditData] = useState(null);
  const [newRoutineInterval, setNewRoutineInterval] = useState('');
  const [activeVariant, setActiveVariant] = useState('GENERAL'); // GENERAL, RAM, JMC

  const handleEdit = (key) => {
    setSelectedRoutineKey(key);
    const routine = JSON.parse(JSON.stringify(routines[key]));
    if (!routine.variants) routine.variants = {};
    if (!routine.supplies) routine.supplies = [];
    setEditData(routine);
    setIsEditing(true);
    setIsCreating(false);
    setActiveVariant('GENERAL');
  };

  const handleCreate = () => {
    setEditData({ name: '', items: [], supplies: [], variants: {} });
    setNewRoutineInterval('');
    setIsCreating(true);
    setIsEditing(true);
    setSelectedRoutineKey(null);
    setActiveVariant('GENERAL');
  };

  const handleSave = () => {
    if (isCreating) {
      if (!newRoutineInterval) {
        alert("Por favor ingrese un intervalo (KM).");
        return;
      }
      if (routines[newRoutineInterval]) {
        alert("Ya existe una rutina para este intervalo.");
        return;
      }
      setRoutines(prev => ({
        ...prev,
        [newRoutineInterval]: editData
      }));
    } else {
      setRoutines(prev => ({
        ...prev,
        [selectedRoutineKey]: editData
      }));
    }
    setIsEditing(false);
    setIsCreating(false);
    setSelectedRoutineKey(null);
    setEditData(null);
  };

  // Helper to get current data based on active variant
  const currentData = useMemo(() => {
      if (!editData) return null;
      if (activeVariant === 'GENERAL') return editData;
      return editData.variants[activeVariant] || null;
  }, [editData, activeVariant]);

  const initVariant = () => {
      setEditData(prev => ({
          ...prev,
          variants: {
              ...prev.variants,
              [activeVariant]: { 
                  name: prev.name + ` (${activeVariant})`, 
                  items: [...prev.items], // Copy items from General
                  supplies: [...(prev.supplies || [])] // Copy supplies
              }
          }
      }));
  };

  const removeVariant = () => {
      if (confirm(`¿Eliminar variación para ${activeVariant}?`)) {
        setEditData(prev => {
            const newVariants = { ...prev.variants };
            delete newVariants[activeVariant];
            return { ...prev, variants: newVariants };
        });
        setActiveVariant('GENERAL');
      }
  };

  const updateField = (field, value) => {
      setEditData(prev => {
          if (activeVariant === 'GENERAL') {
              return { ...prev, [field]: value };
          }
          return {
              ...prev,
              variants: {
                  ...prev.variants,
                  [activeVariant]: { ...prev.variants[activeVariant], [field]: value }
              }
          };
      });
  };
  
  const handleAddItem = () => {
      const currentItems = currentData?.items || [];
      const newItem = { description: '', type: 'Inspección' };
      updateField('items', [...currentItems, newItem]);
  };

  const handleUpdateItem = (idx, field, value) => {
      const newItems = [...(currentData?.items || [])];
      newItems[idx] = { ...newItems[idx], [field]: value };
      updateField('items', newItems);
  };
  
  const handleDeleteItem = (idx) => {
      const newItems = (currentData?.items || []).filter((_, i) => i !== idx);
      updateField('items', newItems);
  };

  const handleAddSupply = () => {
      const currentSupplies = currentData?.supplies || [];
      updateField('supplies', [...currentSupplies, { name: '', reference: '', quantity: '1' }]);
  };

  const handleUpdateSupply = (idx, field, value) => {
      const newSupplies = [...(currentData?.supplies || [])];
      newSupplies[idx] = { ...newSupplies[idx], [field]: value };
      updateField('supplies', newSupplies);
  };

  const handleDeleteSupply = (idx) => {
      const newSupplies = (currentData?.supplies || []).filter((_, i) => i !== idx);
      updateField('supplies', newSupplies);
  };

  if (isEditing && editData) {
    const isVariantActive = activeVariant !== 'GENERAL';
    const variantExists = isVariantActive ? !!editData.variants[activeVariant] : true;

    return (
      <div className="bg-white p-6 rounded-lg shadow animate-in fade-in">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div>
                <h3 className="text-xl font-bold text-slate-800">
                    {isCreating ? 'Crear Nueva Rutina' : `Editando Rutina: ${editData.name}`}
                </h3>
                {isCreating ? (
                    <div className="flex items-center gap-2 mt-2">
                        <label className="text-sm font-bold text-slate-700">Intervalo (KM):</label>
                        <input 
                            type="number" 
                            className="p-1 border rounded w-32" 
                            value={newRoutineInterval}
                            onChange={e => setNewRoutineInterval(e.target.value)}
                            placeholder="Ej: 7500"
                        />
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">Intervalo: {selectedRoutineKey} KM</p>
                )}
            </div>
            <div className="flex gap-2">
                <button onClick={() => { setIsEditing(false); setIsCreating(false); }} className="px-4 py-2 text-slate-600 border rounded hover:bg-slate-50">Cancelar</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Guardar Cambios</button>
            </div>
        </div>

        {/* Variant Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
            {['GENERAL', 'RAM', 'JMC'].map(variant => (
                <button
                    key={variant}
                    onClick={() => setActiveVariant(variant)}
                    className={`px-4 py-2 font-bold border-b-2 transition-colors ${
                        activeVariant === variant 
                        ? 'text-blue-600 border-blue-600' 
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                >
                    {variant === 'GENERAL' ? 'General (Base)' : `Variación ${variant}`}
                    {variant !== 'GENERAL' && editData.variants?.[variant] && <span className="ml-2 text-xs bg-green-100 text-green-800 px-1 rounded">Activo</span>}
                </button>
            ))}
        </div>

        {!variantExists ? (
            <div className="text-center py-12 bg-slate-50 rounded border border-dashed border-slate-300">
                <h4 className="text-lg font-bold text-slate-700 mb-2">No existe variación para {activeVariant}</h4>
                <p className="text-slate-500 mb-4">Esta rutina usará la configuración General a menos que crees una variación específica.</p>
                <button 
                    onClick={initVariant}
                    className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700"
                >
                    Crear Variación para {activeVariant}
                </button>
            </div>
        ) : (
            <>
                {isVariantActive && (
                    <div className="mb-4 flex justify-end">
                        <button onClick={removeVariant} className="text-red-600 text-sm hover:underline">Eliminar esta variación</button>
                    </div>
                )}

                <div className="mb-6">
                    <label className="block font-bold mb-2 text-slate-700">Nombre de la Rutina ({activeVariant})</label>
                    <input 
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={currentData.name} 
                        onChange={e => updateField('name', e.target.value)}
                        placeholder="Ej: Mantenimiento Preventivo Intermedio"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Activities */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block font-bold text-slate-700">Actividades ({currentData.items?.length || 0})</label>
                            <button onClick={handleAddItem} className="text-sm text-blue-600 font-bold flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded"><Plus size={16}/> Agregar</button>
                        </div>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 bg-slate-50 p-2 rounded border">
                            {currentData.items?.length > 0 ? (
                                currentData.items.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border border-slate-200 shadow-sm">
                                        <span className="text-xs font-mono text-slate-400 w-6">{idx + 1}</span>
                                        <select 
                                            className="p-1 border rounded w-28 text-xs"
                                            value={item.type}
                                            onChange={e => handleUpdateItem(idx, 'type', e.target.value)}
                                        >
                                            <option value="Inspección">Inspección</option>
                                            <option value="Preventivo">Preventivo</option>
                                            <option value="Correctivo">Correctivo</option>
                                        </select>
                                        <input 
                                            className="flex-1 p-1 border rounded text-sm"
                                            value={item.description}
                                            onChange={e => handleUpdateItem(idx, 'description', e.target.value)}
                                            placeholder="Descripción..."
                                        />
                                        <button onClick={() => handleDeleteItem(idx)} className="text-red-400 hover:text-red-600"><X size={16}/></button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center p-4 text-slate-400 text-sm">Sin actividades.</div>
                            )}
                        </div>
                    </div>

                    {/* Supplies */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block font-bold text-slate-700">Insumos Requeridos ({currentData.supplies?.length || 0})</label>
                            <button onClick={handleAddSupply} className="text-sm text-green-600 font-bold flex items-center gap-1 hover:bg-green-50 px-2 py-1 rounded"><Plus size={16}/> Agregar</button>
                        </div>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 bg-slate-50 p-2 rounded border">
                            {currentData.supplies?.length > 0 ? (
                                currentData.supplies.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border border-slate-200 shadow-sm">
                                        <input 
                                            className="flex-1 p-1 border rounded text-sm"
                                            value={item.name}
                                            onChange={e => handleUpdateSupply(idx, 'name', e.target.value)}
                                            placeholder="Nombre del Insumo"
                                        />
                                        <input 
                                            className="w-20 p-1 border rounded text-sm"
                                            value={item.quantity}
                                            onChange={e => handleUpdateSupply(idx, 'quantity', e.target.value)}
                                            placeholder="Cant."
                                        />
                                        <button onClick={() => handleDeleteSupply(idx)} className="text-red-400 hover:text-red-600"><X size={16}/></button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center p-4 text-slate-400 text-sm">Sin insumos requeridos.</div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Object.entries(routines).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([key, routine]) => (
        <div key={key} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-t-4 border-blue-500 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-lg text-slate-800">{parseInt(key).toLocaleString()} KM</h3>
            <button onClick={() => handleEdit(key)} className="text-blue-600 hover:bg-blue-50 p-2 rounded" title="Editar Rutina"><Wrench size={18}/></button>
          </div>
          <p className="text-slate-600 text-sm mb-4 flex-1">{routine.name}</p>
          
          {/* Variants Badges */}
          {routine.variants && Object.keys(routine.variants).length > 0 && (
              <div className="flex gap-1 mb-2 flex-wrap">
                  {Object.keys(routine.variants).map(v => (
                      <span key={v} className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200 font-bold">
                          {v}
                      </span>
                  ))}
              </div>
          )}

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded flex justify-between items-center">
            <span><strong>{routine.items?.length || 0}</strong> Actividades</span>
            <span className="text-blue-600 font-semibold">Ver detalles</span>
          </div>
        </div>
      ))}
      
      <button 
        onClick={handleCreate}
        className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-colors min-h-[200px]"
      >
        <Plus size={32} className="mb-2" />
        <span className="font-bold">Crear Nueva Rutina</span>
      </button>
    </div>
  );
};

const MaintenanceAdminView = ({ workOrders, setWorkOrders, setFleet, routines, setRoutines }) => {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('ots'); // 'ots' or 'routines'
  const [closingOT, setClosingOT] = useState(null);
  const [closingData, setClosingData] = useState({
    realDate: new Date().toISOString().split('T')[0],
    realMileage: '',
    observations: ''
  });

  const handleCloseOT = () => {
    if (!closingOT) return;

    // 1. Update Work Order Status
    setWorkOrders(prev => prev.map(ot => 
      ot.id === closingOT.id ? {
        ...ot,
        status: 'CERRADA',
        closingDate: closingData.realDate,
        realMileage: closingData.realMileage,
        observations: closingData.observations
      } : ot
    ));

    // 2. Reprogram Maintenance Cycle (Update Fleet Data)
    if (closingData.realMileage) {
      const newMileage = parseInt(closingData.realMileage);
      setFleet(prevFleet => prevFleet.map(vehicle => {
        if (vehicle.code === closingOT.vehicleCode || vehicle.plate === closingOT.plate) {
          return {
            ...vehicle,
            mileage: newMileage, // Update current mileage to the one reported in OT
            lastMaintenance: newMileage // Reset the maintenance counter/cycle
          };
        }
        return vehicle;
      }));
    }

    setClosingOT(null);
    setClosingData({ realDate: new Date().toISOString().split('T')[0], realMileage: '', observations: '' });
  };

  const filteredOTs = workOrders.filter(ot => 
    ot.vehicleCode.toLowerCase().includes(filter.toLowerCase()) ||
    ot.plate.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Wrench className="text-blue-600" /> Administración de Mantenimiento
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('ots')}
          className={`px-4 py-2 font-bold border-b-2 transition-colors ${activeTab === 'ots' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
        >
          Órdenes de Trabajo
        </button>
        <button 
          onClick={() => setActiveTab('routines')}
          className={`px-4 py-2 font-bold border-b-2 transition-colors ${activeTab === 'routines' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
        >
          Gestión de Rutinas
        </button>
      </div>

      {activeTab === 'routines' ? (
        <RoutinesManager routines={routines} setRoutines={setRoutines} />
      ) : (
        <>
          <div className="bg-white p-4 rounded-lg shadow flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Filtrar por placa o código..." 
                className="w-full pl-10 p-2 border rounded-lg"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                <tr>
                  <th className="p-4">OT #</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Vehículo</th>
                  <th className="p-4">Rutina</th>
                  <th className="p-4">Taller</th>
                  <th className="p-4">Fecha Creación</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOTs.length > 0 ? (
                  filteredOTs.map(ot => (
                    <tr key={ot.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono font-bold text-blue-600">#{ot.id}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          ot.status === 'ABIERTA' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {ot.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold">{ot.plate}</div>
                        <div className="text-xs text-slate-500">{ot.vehicleCode}</div>
                      </td>
                      <td className="p-4">{ot.routineName}</td>
                      <td className="p-4 text-slate-600">{ot.workshop}</td>
                      <td className="p-4">{ot.creationDate}</td>
                      <td className="p-4">
                        {ot.status === 'ABIERTA' && (
                          <button 
                            onClick={() => setClosingOT(ot)}
                            className="text-green-600 hover:underline font-medium"
                          >
                            Cerrar OT
                          </button>
                        )}
                        {ot.status === 'CERRADA' && (
                          <span className="text-slate-400 italic text-xs">Cerrada el {ot.closingDate}</span>
                        )}
                        <button 
                          onClick={() => generatePDF(ot)}
                          className="ml-2 text-slate-600 hover:text-blue-600"
                          title="Descargar PDF"
                        >
                          <FileText size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400 italic">
                      No hay órdenes de trabajo registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal for Closing OT */}
      {closingOT && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">Cerrar Orden de Trabajo #{closingOT.id}</h3>
            <p className="text-sm text-slate-600 mb-4">
              Vehículo: <strong>{closingOT.plate}</strong> - {closingOT.routineName}
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Real Ejecución</label>
                <input 
                  type="date" 
                  className="w-full p-2 border rounded"
                  value={closingData.realDate}
                  onChange={(e) => setClosingData({...closingData, realDate: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kilometraje Real</label>
                <input 
                  type="number" 
                  className="w-full p-2 border rounded"
                  value={closingData.realMileage}
                  onChange={(e) => setClosingData({...closingData, realMileage: e.target.value})}
                  placeholder="Ej: 15200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                <textarea 
                  className="w-full p-2 border rounded"
                  rows="3"
                  value={closingData.observations}
                  onChange={(e) => setClosingData({...closingData, observations: e.target.value})}
                  placeholder="Detalles de la ejecución..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setClosingOT(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCloseOT}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold"
              >
                Cerrar OT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const WorkOrders = ({ fleet }) => {
  const [formData, setFormData] = useState({
    code: '',
    plate: '',
    model: '',
    vin: '',
    mileage: '',
    date: new Date().toISOString().split('T')[0],
    area: 'OPERATIVA',
    location: 'TALLER EL HATO',
    requester: 'CDMT',
    qualityCode: 'F-MTO-001',
    maintenanceType: '',
    maintenanceDescription: '',
    brandVariant: 'AUTO'
  });
  const [suggestions, setSuggestions] = useState([]);

  const handleCodeChange = (e) => {
    const value = e.target.value.toUpperCase();
    setFormData(prev => ({ ...prev, code: value }));
    
    if (value.length > 1) {
      const matches = fleet.filter(v => 
        v.code.toUpperCase().includes(value) && 
        (v.model.toLowerCase().includes('camioneta') || v.code.startsWith('PVHC'))
      );
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };

  const selectVehicle = (vehicle) => {
    // Auto-detect brand variant if possible
    let detectedBrand = 'AUTO';
    if (vehicle.model.toUpperCase().includes('RAM')) detectedBrand = 'RAM';
    if (vehicle.model.toUpperCase().includes('JMC')) detectedBrand = 'JMC';

    setFormData(prev => ({
      ...prev,
      code: vehicle.code,
      plate: vehicle.plate,
      model: vehicle.model,
      vin: vehicle.year.toString(),
      mileage: '',
      maintenanceType: '',
      maintenanceDescription: '',
      brandVariant: detectedBrand
    }));
    setSuggestions([]);
  };

  const handleMileageChange = (e) => {
    const km = parseInt(e.target.value) || 0;
    const cycle = Math.floor(km / 5000) % 12;
    const type = cycle === 0 ? "MP12" : `MP${cycle}`;
    
    setFormData(prev => ({
      ...prev,
      mileage: e.target.value,
      maintenanceType: type,
      maintenanceDescription: `MANTENIMIENTO PREVENTIVO ${type} (${km} KM)`
    }));
  };

  const handleGenerate = () => {
    const modelToUse = formData.brandVariant !== 'AUTO' ? formData.brandVariant : formData.model;
    const routine = getNextRoutine(parseInt(formData.mileage) || 0, modelToUse);
    
    const workOrder = {
      id: Math.floor(Math.random() * 10000),
      vehicleCode: formData.code,
      vehicleModel: formData.model,
      plate: formData.plate,
      routineName: routine.name || formData.maintenanceDescription,
      mileage: formData.mileage,
      items: routine.items || [],
      supplies: routine.supplies || []
    };
    generatePDF(workOrder);
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-blue-600 p-6 text-white">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText /> Generación Manual de OT
          </h2>
          <p className="text-blue-100 mt-1">Sistema enfocado en Camionetas (PVHC)</p>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Columna 1: Identificación del Activo */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">
              <Car className="inline mr-2" size={20}/> Identificación del Activo
            </h3>
            
            <div className="relative">
              <label className="block text-sm font-medium text-slate-600 mb-1">Código Interno (Master)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={handleCodeChange}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 pl-10"
                  placeholder="Ej: PVHC053"
                />
                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
              </div>
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                  {suggestions.map(v => (
                    <div 
                      key={v.id} 
                      onClick={() => selectVehicle(v)}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                    >
                      <div className="font-bold text-slate-800">{v.code}</div>
                      <div className="text-xs text-slate-500">{v.model} - {v.plate}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Placa</label>
                <input type="text" value={formData.plate} readOnly className="w-full p-3 bg-slate-100 border rounded-lg text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Modelo</label>
                <input type="text" value={formData.model} readOnly className="w-full p-3 bg-slate-100 border rounded-lg text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">VIN / Año</label>
              <input type="text" value={formData.vin} readOnly className="w-full p-3 bg-slate-100 border rounded-lg text-slate-500" />
            </div>
          </div>

          {/* Columna 2: Datos Operativos */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">
              <Wrench className="inline mr-2" size={20}/> Datos Operativos
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Rutina (Marca)</label>
              <select 
                value={formData.brandVariant}
                onChange={(e) => setFormData({...formData, brandVariant: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="AUTO">Detectar Automáticamente</option>
                <option value="RAM">RAM</option>
                <option value="JMC">JMC</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Seleccione manualmente si el modelo no es detectado.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Kilometraje Actual</label>
              <input 
                type="number" 
                value={formData.mileage}
                onChange={handleMileageChange}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ingrese KM actual"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="text-sm text-blue-800 font-semibold mb-1">Mantenimiento Calculado</div>
              <div className="text-xl font-bold text-blue-900">{formData.maintenanceType || '---'}</div>
              <div className="text-xs text-blue-600 mt-1">{formData.maintenanceDescription}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Fecha</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full p-3 border rounded-lg" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Área</label>
                <input 
                  type="text" 
                  value={formData.area}
                  onChange={e => setFormData({...formData, area: e.target.value})}
                  className="w-full p-3 border rounded-lg" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Ubicación</label>
                <input 
                  type="text" 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full p-3 border rounded-lg" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Solicitante</label>
                <input 
                  type="text" 
                  value={formData.requester}
                  onChange={e => setFormData({...formData, requester: e.target.value})}
                  className="w-full p-3 border rounded-lg" 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t flex justify-end">
          <button 
            onClick={handleGenerate}
            disabled={!formData.code || !formData.mileage}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            <FileText size={20} /> Generar Orden de Trabajo
          </button>
        </div>
      </div>
    </div>
  );
};

const DriverAssignment = ({ fleet, setFleet }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter for Pickups (Camionetas) only - PVHC codes
  const pickups = useMemo(() => {
    return fleet.filter(v => 
      v.code.startsWith('PVHC') || 
      v.model.toUpperCase().includes('CAMIONETA')
    );
  }, [fleet]);

  const handleDriverChange = (vehicleId, newDriver) => {
    setFleet(prev => prev.map(v => 
      v.id === vehicleId ? { ...v, driver: newDriver } : v
    ));
  };

  const filteredFleet = pickups.filter(v => 
    v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Car className="text-blue-600" /> Asignación de Conductores (Camionetas)
      </h2>

      <div className="bg-white p-4 rounded-lg shadow flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por placa, conductor o código..." 
            className="w-full pl-10 p-2 border rounded-lg"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <span className="text-sm text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
          {filteredFleet.length} de {pickups.length} camionetas
        </span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-250px)]">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-700 text-white uppercase font-bold sticky top-0">
              <tr>
                <th className="p-4">Código</th>
                <th className="p-4">Placa</th>
                <th className="p-4">Modelo</th>
                <th className="p-4">Conductor Asignado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredFleet.map(vehicle => (
                <tr key={vehicle.id} className="hover:bg-blue-50 transition-colors">
                  <td className="p-4 font-mono text-blue-600 font-bold">{vehicle.code}</td>
                  <td className="p-4 font-bold text-slate-800">{vehicle.plate}</td>
                  <td className="p-4 text-slate-500 text-xs">{vehicle.model}</td>
                  <td className="p-4">
                    <input 
                      type="text" 
                      value={vehicle.driver}
                      onChange={(e) => handleDriverChange(vehicle.id, e.target.value)}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Sin Asignar"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const DataLoad = ({ fleet, setFleet, setVariableHistory }) => {
  const [pasteData, setPasteData] = useState('');
  const [preview, setPreview] = useState([]);
  const [hasErrors, setHasErrors] = useState(false);

  const parseData = () => {
    const rows = pasteData.trim().split('\n');
    let errorFound = false;
    const latestRecords = {};

    // 1. Parse and Deduplicate (Keep latest date per plate)
    rows.forEach(row => {
      // Expecting: Date | KM | Plate | Code (Tab separated)
      // Example: 12/12/2025 08:20:25 | 33.394,000 | NTW668 | (empty)
      const cols = row.split(/\t/);
      if (cols.length < 3) return;

      const dateRaw = cols[0]?.trim();
      const kmRaw = cols[1]?.trim();
      const plate = cols[2]?.trim();
      
      // Parse KM: "33.394,000" -> 33394
      // Remove dots (thousands), split by comma (decimals)
      const kmClean = kmRaw?.split(',')[0].replace(/\./g, '');
      const newKm = parseInt(kmClean) || 0;

      // Parse Date for comparison
      // "12/12/2025 08:20:25" -> Date Object
      const [d, t] = dateRaw.split(' ');
      const [day, month, year] = d.split('/');
      const isoDate = `${year}-${month}-${day}T${t}`;
      const dateObj = new Date(isoDate);

      if (!latestRecords[plate] || dateObj > latestRecords[plate].dateObj) {
        latestRecords[plate] = {
          dateRaw,
          dateObj,
          km: newKm,
          plate,
          originalRow: row
        };
      }
    });

    // 2. Validate against Fleet
    const parsed = Object.values(latestRecords).map(record => {
      // Find current vehicle data by Plate
      const currentVehicle = fleet.find(v => v.plate === record.plate);
      
      let status = 'VALID';
      let message = 'OK';
      let code = currentVehicle?.code || '---';

      if (!currentVehicle) {
        status = 'ERROR';
        message = 'Vehículo no encontrado por Placa';
        errorFound = true;
      } else {
        const currentKm = currentVehicle.mileage;
        
        if (record.km < currentKm) {
          status = 'ERROR';
          message = `KM Menor al actual (${currentKm})`;
          errorFound = true;
        } else if (currentKm > 0 && record.km > currentKm + 30000) { 
          status = 'WARNING';
          message = `Salto de KM alto (>30k)`;
        }
      }

      return {
        date: record.dateRaw,
        km: record.km,
        code: code,
        plate: record.plate,
        status,
        message
      };
    });

    setPreview(parsed);
    setHasErrors(errorFound);
  };

  const applyChanges = () => {
    let recordsToProcess = preview;

    if (hasErrors) {
      if (!window.confirm("Hay errores en algunos registros. ¿Desea omitirlos y cargar SOLO los registros válidos (OK)?")) {
        return;
      }
      // Filter only valid records
      recordsToProcess = preview.filter(p => p.status !== 'ERROR');
      
      if (recordsToProcess.length === 0) {
        alert("No hay registros válidos para procesar.");
        return;
      }
    }

    // 1. Update Fleet (Only mileage, NOT lastMaintenance)
    setFleet(prev => {
      const newFleet = [...prev];
      recordsToProcess.forEach(update => {
        const index = newFleet.findIndex(v => v.code === update.code || v.plate === update.plate);
        if (index !== -1) {
          newFleet[index] = {
            ...newFleet[index],
            mileage: update.km
            // Do NOT update lastMaintenance here - it should only change when a maintenance OT is closed
          };
        }
      });
      return newFleet;
    });

    // 2. Save to History
    setVariableHistory(prev => [...prev, ...recordsToProcess.map(p => ({
      ...p,
      uploadDate: new Date().toISOString()
    }))]);

    alert(`Se procesaron ${recordsToProcess.length} registros correctamente.`);
    setPasteData('');
    setPreview([]);
    setHasErrors(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Upload className="text-blue-600" /> Carga Masiva de Variables
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-4">1. Pegar Datos (Excel)</h3>
          <p className="text-sm text-slate-500 mb-2">
            Formato esperado: <strong>Fecha | Kilometraje | Placa | Código</strong><br/>
            <span className="text-xs italic">El sistema tomará automáticamente el registro más reciente por placa.</span>
          </p>
          <textarea 
            className="w-full h-64 p-4 border rounded-lg font-mono text-sm bg-slate-50 whitespace-pre"
            placeholder={`12/12/2025 08:20:25\t33.394,000\tNTW668\t\n12/12/2025 08:13:40\t28.577,000\tNNL597\t`}
            value={pasteData}
            onChange={e => setPasteData(e.target.value)}
          />
          <button 
            onClick={parseData}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 w-full"
          >
            Validar y Previsualizar
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow flex flex-col">
          <h3 className="font-semibold mb-4">2. Validación</h3>
          <div className="flex-1 overflow-auto border rounded-lg bg-slate-50">
            {preview.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-200 text-slate-700">
                  <tr>
                    <th className="p-2">Estado</th>
                    <th className="p-2">KM Nuevo</th>
                    <th className="p-2">Vehículo</th>
                    <th className="p-2">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={`border-b ${row.status === 'ERROR' ? 'bg-red-50' : ''}`}>
                      <td className="p-2">
                        {row.status === 'ERROR' ? (
                          <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={14}/> Error</span>
                        ) : (
                          <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={14}/> OK</span>
                        )}
                      </td>
                      <td className="p-2 font-bold">{row.km}</td>
                      <td className="p-2">
                        <div>{row.plate}</div>
                        <div className="text-xs text-slate-500">{row.code}</div>
                      </td>
                      <td className={`p-2 text-xs ${row.status === 'ERROR' ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                        {row.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 italic">
                Pegue datos para validar...
              </div>
            )}
          </div>
          <button 
            onClick={applyChanges}
            disabled={preview.length === 0}
            className={`mt-4 text-white px-6 py-2 rounded w-full disabled:opacity-50 disabled:cursor-not-allowed font-bold ${hasErrors ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {hasErrors ? 'Omitir Errores y Cargar Válidos' : 'Aplicar Cambios a la Flota'}
          </button>
        </div>
      </div>
    </div>
  );
};

const DatabaseView = ({ fleet, setFleet }) => {
  const [pasteData, setPasteData] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Filter for Pickups
  const pickups = useMemo(() => {
    return fleet.filter(v => 
      v.code.startsWith('PVHC') || 
      v.model.toUpperCase().includes('CAMIONETA')
    );
  }, [fleet]);

  // Calculate Stats
  const stats = useMemo(() => {
    const brands = {};
    const owners = {};
    
    pickups.forEach(v => {
      const brand = v.brand || 'Sin Marca';
      const owner = v.owner || 'Sin Propietario';
      brands[brand] = (brands[brand] || 0) + 1;
      owners[owner] = (owners[owner] || 0) + 1;
    });

    return { brands, owners };
  }, [pickups]);

  const handleBulkUpdate = () => {
    const rows = pasteData.trim().split('\n');
    const updates = rows.map(row => {
      const cols = row.split(/\t|,/);
      // Expected: Code | Brand | Owner | Model | Plate
      return {
        code: cols[0]?.trim(),
        brand: cols[1]?.trim(),
        owner: cols[2]?.trim(),
        model: cols[3]?.trim(),
        plate: cols[4]?.trim()
      };
    });

    setFleet(prev => {
      const newFleet = [...prev];
      updates.forEach(u => {
        if (!u.code) return;
        const idx = newFleet.findIndex(v => v.code === u.code);
        if (idx !== -1) {
          newFleet[idx] = {
            ...newFleet[idx],
            brand: u.brand || newFleet[idx].brand,
            owner: u.owner || newFleet[idx].owner,
            model: u.model || newFleet[idx].model,
            plate: u.plate || newFleet[idx].plate
          };
        }
      });
      return newFleet;
    });
    
    setIsEditing(false);
    setPasteData('');
    alert('Base de datos actualizada correctamente');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Database className="text-blue-600" /> Base de Datos de Camionetas
        </h2>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm flex items-center gap-2"
        >
          <Upload size={16} /> {isEditing ? 'Cancelar Edición' : 'Actualizar desde Excel'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <PieChart size={20} /> Resumen por Marca
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(stats.brands).map(([brand, count]) => (
              <div key={brand} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                <span className="font-medium text-slate-600">{brand}</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Car size={20} /> Resumen por Propietario
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(stats.owners).map(([owner, count]) => (
              <div key={owner} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                <span className="font-medium text-slate-600">{owner}</span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Edit Area */}
      {isEditing && (
        <div className="bg-white p-6 rounded-lg shadow border border-blue-200 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold text-lg mb-2">Pegar Datos de Excel</h3>
          <p className="text-sm text-slate-500 mb-4">
            Copie y pegue las columnas en este orden: <strong>CÓDIGO | MARCA | PROPIETARIO | MODELO | PLACA</strong>
          </p>
          <textarea 
            className="w-full h-40 p-4 border rounded-lg font-mono text-sm bg-slate-50 mb-4"
            placeholder={`PVHC001\tTOYOTA\tPROPIO\tHILUX 4x4\tABC-123\nPVHC002\tNISSAN\tALQUILADO\tFRONTIER\tXYZ-789`}
            value={pasteData}
            onChange={e => setPasteData(e.target.value)}
          />
          <button 
            onClick={handleBulkUpdate}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-bold"
          >
            Procesar y Actualizar
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-4 border-b">Código</th>
                <th className="p-4 border-b">Placa</th>
                <th className="p-4 border-b">Marca</th>
                <th className="p-4 border-b">Modelo</th>
                <th className="p-4 border-b">Propietario</th>
                <th className="p-4 border-b">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pickups.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono text-blue-600 font-bold">{vehicle.code}</td>
                  <td className="p-4 font-bold">{vehicle.plate}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-slate-100 rounded text-slate-600 text-xs font-bold border">
                      {vehicle.brand || '---'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{vehicle.model}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      vehicle.owner === 'PROPIO' ? 'bg-green-100 text-green-800' : 
                      vehicle.owner === 'ALQUILADO' ? 'bg-orange-100 text-orange-800' : 
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {vehicle.owner || '---'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs border border-green-200">
                      {vehicle.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

function App() {
  const [currentView, setCurrentView] = useState('planning'); // Default to planning view
  
  // Initialize state from localStorage or defaults
  const [fleet, setFleet] = useState(() => {
    const saved = localStorage.getItem('fleet_data');
    return saved ? JSON.parse(saved) : INITIAL_FLEET;
  });
  
  const [workOrders, setWorkOrders] = useState(() => {
    const saved = localStorage.getItem('work_orders');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [variableHistory, setVariableHistory] = useState(() => {
    const saved = localStorage.getItem('variable_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [routines, setRoutines] = useState(() => {
    const saved = localStorage.getItem('maintenance_routines');
    return saved ? JSON.parse(saved) : MAINTENANCE_ROUTINES;
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Persist data to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('fleet_data', JSON.stringify(fleet));
  }, [fleet]);

  useEffect(() => {
    localStorage.setItem('work_orders', JSON.stringify(workOrders));
  }, [workOrders]);

  useEffect(() => {
    localStorage.setItem('variable_history', JSON.stringify(variableHistory));
  }, [variableHistory]);

  useEffect(() => {
    localStorage.setItem('maintenance_routines', JSON.stringify(routines));
  }, [routines]);

  const handleCreateOT = (newOT) => {
    setWorkOrders(prev => [newOT, ...prev]);
  };

  const renderView = () => {
    switch(currentView) {
      case 'planning': return <PlanningView fleet={fleet} setFleet={setFleet} onCreateOT={handleCreateOT} workOrders={workOrders} setWorkOrders={setWorkOrders} variableHistory={variableHistory} routines={routines} />;
      case 'maintenance-admin': return <MaintenanceAdminView workOrders={workOrders} setWorkOrders={setWorkOrders} setFleet={setFleet} routines={routines} setRoutines={setRoutines} />;
      case 'work-orders': return <WorkOrders fleet={fleet} />;
      case 'drivers': return <DriverAssignment fleet={fleet} setFleet={setFleet} />;
      case 'dataload': return <DataLoad fleet={fleet} setFleet={setFleet} setVariableHistory={setVariableHistory} />;
      default: return <PlanningView fleet={fleet} onCreateOT={handleCreateOT} workOrders={workOrders} />;
    }
  };

  const getTitle = () => {
    switch(currentView) {
      case 'planning': return 'Planeación de Mantenimiento (Camionetas)';
      case 'maintenance-admin': return 'Administración de Mantenimiento';
      case 'work-orders': return 'Generador de Órdenes de Trabajo';
      case 'drivers': return 'Asignación de Conductores';
      case 'dataload': return 'Carga Masiva de Variables';
      default: return 'Fleet Pro';
    }
  };

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-700">
          {isSidebarOpen && <h1 className="font-bold text-xl tracking-wider">FLEET PRO</h1>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-800 rounded">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 py-6">
          <ul className="space-y-2">
            <li>
              <button 
                onClick={() => setCurrentView('planning')}
                className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-800 transition-colors ${currentView === 'planning' ? 'bg-blue-600' : ''}`}
              >
                <Calendar size={20} />
                {isSidebarOpen && <span>Planeación</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('maintenance-admin')}
                className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-800 transition-colors ${currentView === 'maintenance-admin' ? 'bg-blue-600' : ''}`}
              >
                <Wrench size={20} />
                {isSidebarOpen && <span>Admin. Mantenimiento</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('work-orders')}
                className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-800 transition-colors ${currentView === 'work-orders' ? 'bg-blue-600' : ''}`}
              >
                <ClipboardList size={20} />
                {isSidebarOpen && <span>Generar OTs</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('drivers')}
                className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-800 transition-colors ${currentView === 'drivers' ? 'bg-blue-600' : ''}`}
              >
                <Car size={20} />
                {isSidebarOpen && <span>Conductores</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('dataload')}
                className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-800 transition-colors ${currentView === 'dataload' ? 'bg-blue-600' : ''}`}
              >
                <Upload size={20} />
                {isSidebarOpen && <span>Cargar Variables</span>}
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800 capitalize">
            {getTitle()}
          </h2>
        </header>
        
        {renderView()}
      </main>
    </div>
  );
}

export default App;
