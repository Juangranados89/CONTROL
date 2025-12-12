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
  PieChart
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

const PlanningView = ({ fleet, onCreateOT, workOrders = [], variableHistory = [], routines = MAINTENANCE_ROUTINES }) => {
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [workshop, setWorkshop] = useState('');
  const [viewingHistoryVehicle, setViewingHistoryVehicle] = useState(null);
  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);

  // Helper to get next routine using the passed routines prop
  const getNextRoutineLocal = (mileage, vehicleModel = '') => {
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

    // Find the first interval greater than current mileage
    const nextInterval = intervals.find(interval => interval > mileage);
    
    // Fallback if no higher interval is found (use the highest one)
    const targetInterval = nextInterval || intervals[intervals.length - 1];
    
    const baseRoutine = routines[targetInterval] || { name: 'Mantenimiento Estándar', items: [], supplies: [], variants: {} };
    
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
    
    const routine = getNextRoutineLocal(selectedVehicle.mileage, selectedVehicle.model);
    
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
    const closedOTs = workOrders
      .filter(ot => (ot.vehicleCode === vehicle.code || ot.plate === vehicle.plate) && ot.status === 'CERRADA')
      .sort((a, b) => new Date(b.closingDate) - new Date(a.closingDate));
    
    if (closedOTs.length > 0) return closedOTs[0].closingDate;
    return "---";
  };

  const weeklyPlan = useMemo(() => {
    // 1. Identify candidates (Remaining < 3000km or Vencido)
    const candidates = pickups.map(v => {
        const next = getNextRoutineLocal(v.mileage, v.model);
        const remaining = next.km - v.mileage;
        return { ...v, remaining, nextRoutine: next };
    }).filter(v => v.remaining < 3000).sort((a, b) => a.remaining - b.remaining);

    // 2. Distribute Mon-Fri
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const plan = { Lunes: [], Martes: [], Miércoles: [], Jueves: [], Viernes: [] };
    
    candidates.forEach((v, i) => {
        const dayIndex = i % 5; 
        plan[days[dayIndex]].push(v);
    });
    
    return plan;
  }, [pickups, routines]);

  return (
    <div className="p-6 space-y-6 relative">
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

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="text-blue-600" />
          Planeación de Mantenimientos (Camionetas)
        </h2>
        <div className="flex gap-2">
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

      <div className="bg-white rounded-lg shadow overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-4 border-b">Estado</th>
                <th className="p-4 border-b">Vehículo</th>
                <th className="p-4 border-b">Modelo</th>
                <th className="p-4 border-b">F. Última Var.</th>
                <th className="p-4 border-b">Variable</th>
                <th className="p-4 border-b">F. Último Mtto</th>
                <th className="p-4 border-b">Var. Último Mtto</th>
                <th className="p-4 border-b">Próxima Rutina</th>
                <th className="p-4 border-b">Falta (KM)</th>
                <th className="p-4 border-b">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pickups.map((vehicle) => {
                const nextRoutine = getNextRoutineLocal(vehicle.mileage, vehicle.model);
                const kmRemaining = nextRoutine.km - vehicle.mileage;
                
                let statusColor = "bg-green-100 text-green-800";
                let statusText = "OK";
                
                if (kmRemaining < 0) {
                  statusColor = "bg-red-100 text-red-800";
                  statusText = "VENCIDO";
                } else if (kmRemaining < 1000) {
                  statusColor = "bg-yellow-100 text-yellow-800";
                  statusText = "PRÓXIMO";
                }

                return (
                  <tr 
                    key={vehicle.id} 
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => setViewingHistoryVehicle(vehicle)}
                  >
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                        {statusText}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{vehicle.plate}</div>
                      <div className="text-xs text-blue-600">{vehicle.code}</div>
                    </td>
                    <td className="p-4 text-slate-600 text-xs">
                      {vehicle.model}
                    </td>
                    <td className="p-4 text-slate-600">
                      {getLastVariableDate(vehicle)}
                    </td>
                    <td className="p-4 font-mono font-bold">
                      {vehicle.mileage.toLocaleString()}
                    </td>
                    <td className="p-4 text-slate-600">
                      {getLastMaintenanceDate(vehicle)}
                    </td>
                    <td className="p-4 text-slate-500">
                      {vehicle.lastMaintenance.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-blue-700">{nextRoutine.km.toLocaleString()} km</div>
                      <div className="text-xs text-slate-500">{nextRoutine.name}</div>
                    </td>
                    <td className={`p-4 font-bold ${kmRemaining < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {kmRemaining.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={(e) => handleQuickGenerateClick(e, vehicle)}
                        className="text-blue-600 hover:underline font-medium flex items-center gap-1 z-10 relative"
                      >
                        <FileText size={14} /> Generar OT
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

  const handleDriverChange = (vehicleId, newDriver) => {
    setFleet(prev => prev.map(v => 
      v.id === vehicleId ? { ...v, driver: newDriver } : v
    ));
  };

  const filteredFleet = fleet.filter(v => 
    v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Car className="text-blue-600" /> Asignación de Conductores
      </h2>

      <div className="bg-white p-4 rounded-lg shadow flex gap-4">
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
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
            <tr>
              <th className="p-4">Código</th>
              <th className="p-4">Placa</th>
              <th className="p-4">Modelo</th>
              <th className="p-4">Conductor Asignado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredFleet.map(vehicle => (
              <tr key={vehicle.id} className="hover:bg-slate-50">
                <td className="p-4 font-mono text-blue-600">{vehicle.code}</td>
                <td className="p-4 font-bold">{vehicle.plate}</td>
                <td className="p-4 text-slate-500">{vehicle.model}</td>
                <td className="p-4">
                  <input 
                    type="text" 
                    value={vehicle.driver}
                    onChange={(e) => handleDriverChange(vehicle.id, e.target.value)}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Sin Asignar"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

    const parsed = rows.map(row => {
      // Expecting: Date | KM | Code | Plate (Tab or comma separated)
      const cols = row.split(/\t|,/);
      const newKm = parseInt(cols[1]?.trim()) || 0;
      const code = cols[2]?.trim();
      const plate = cols[3]?.trim();
      
      // Find current vehicle data
      const currentVehicle = fleet.find(v => v.code === code || v.plate === plate);
      
      let status = 'VALID';
      let message = 'OK';

      if (!currentVehicle) {
        status = 'ERROR';
        message = 'Vehículo no encontrado';
        errorFound = true;
      } else {
        const currentKm = currentVehicle.mileage;
        
        if (newKm < currentKm) {
          status = 'ERROR';
          message = `KM Menor al actual (${currentKm})`;
          errorFound = true;
        } else if (currentKm > 0 && newKm > currentKm + 30000) { // Max jump threshold (only if vehicle has history)
          status = 'ERROR';
          message = `Salto de KM excesivo (>30k)`;
          errorFound = true;
        }
      }

      return {
        date: cols[0]?.trim(),
        km: newKm,
        code: code,
        plate: plate,
        status,
        message
      };
    });

    setPreview(parsed);
    setHasErrors(errorFound);
  };

  const applyChanges = () => {
    if (hasErrors) {
      alert("Por favor corrija los errores antes de aplicar.");
      return;
    }

    // 1. Update Fleet (Reprogramming)
    setFleet(prev => {
      const newFleet = [...prev];
      preview.forEach(update => {
        const index = newFleet.findIndex(v => v.code === update.code || v.plate === update.plate);
        if (index !== -1) {
          newFleet[index] = {
            ...newFleet[index],
            mileage: update.km,
            lastMaintenance: update.km // Reset cycle based on new reading
          };
        }
      });
      return newFleet;
    });

    // 2. Save to History
    setVariableHistory(prev => [...prev, ...preview.map(p => ({
      ...p,
      uploadDate: new Date().toISOString()
    }))]);

    alert('Datos actualizados correctamente y guardados en historial.');
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
          <p className="text-sm text-slate-500 mb-2">Formato: Fecha | KM | Código | Placa</p>
          <textarea 
            className="w-full h-64 p-4 border rounded-lg font-mono text-sm bg-slate-50"
            placeholder={`2023-10-27\t15000\tPVHC001\tABC-123\n2023-10-28\t15500\tPVHC002\tXYZ-789`}
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
            disabled={preview.length === 0 || hasErrors}
            className="mt-4 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {hasErrors ? 'Corrija los errores para continuar' : 'Aplicar Cambios a la Flota'}
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
  const [fleet, setFleet] = useState(INITIAL_FLEET);
  const [workOrders, setWorkOrders] = useState([]); // Store OTs
  const [variableHistory, setVariableHistory] = useState([]); // Store variable history
  const [routines, setRoutines] = useState(MAINTENANCE_ROUTINES); // Store routines
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleCreateOT = (newOT) => {
    setWorkOrders(prev => [newOT, ...prev]);
  };

  const renderView = () => {
    switch(currentView) {
      case 'planning': return <PlanningView fleet={fleet} onCreateOT={handleCreateOT} workOrders={workOrders} variableHistory={variableHistory} routines={routines} />;
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
