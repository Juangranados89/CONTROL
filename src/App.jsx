import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  TrendingUp,
  Filter,
  BarChart3,
  Activity,
  Users,
  History,
  Download,
  Check,
  CheckCircle2,
  Circle,
  AlertCircle,
  MapPin,
  CircleDot,
  Fuel
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { INITIAL_FLEET, MAINTENANCE_ROUTINES } from './data';
import api from './api';
import UserInfoHeader from './components/UserInfoHeader';
import Login from './components/Login';
import NotificationBadge from './components/NotificationBadge';
import ExportMenu from './components/ExportMenu';
import VariableHistory from './components/VariableHistory';
import BulkImportGrid from './components/BulkImportGrid';
import MaintenanceDataLoader from './components/MaintenanceDataLoader';
import CloseOTModal from './components/CloseOTModal';
import { useDialog } from './components/DialogProvider.jsx';

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

const generatePDF = async (workOrder, notify) => {
  const notifyFn = typeof notify === 'function' ? notify : null;
  if (!window.jspdf) {
    if (notifyFn) {
      await notifyFn('La librería jsPDF no está cargada.', { title: 'Error', variant: 'danger' });
    }
    return;
  }

  const formatMonthYear = (value) => {
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

    let dateObj = null;
    if (value instanceof Date) {
      dateObj = value;
    } else if (typeof value === 'string' && value.trim()) {
      const v = value.trim();
      // DD/MM/YYYY
      const m1 = v.match(/^([0-3]?\d)\/(\d{1,2})\/(\d{4})$/);
      if (m1) {
        const day = Number(m1[1]);
        const month = Number(m1[2]) - 1;
        const year = Number(m1[3]);
        dateObj = new Date(year, month, day);
      } else {
        // ISO or anything Date can parse
        const parsed = new Date(v);
        if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
      }
    }

    if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
    const mon = months[dateObj.getMonth()] || '';
    const yy = String(dateObj.getFullYear()).slice(-2);
    return mon && yy ? `${mon}-${yy}` : '';
  };

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
  
  // Bottom part: solo código + fecha (MES-YY)
  const headerCode = 'FEYM936.00.CO';
  const headerDate = formatMonthYear(workOrder.creationDate) || formatMonthYear(workOrder.createdAt) || formatMonthYear(new Date());
  doc.setFontSize(10);
  doc.text(headerCode, startX + 140 + 25, startY + 24, { align: 'center' });
  doc.setFontSize(8);
  doc.text(headerDate, startX + 140 + 25, startY + 29, { align: 'center' });


  // --- GENERAL INFO (Grid Layout) ---
  const infoStartY = startY + headerHeight + 5; // Spacing after header

  // Get area operativa from vehicle, default to 40BU-TM1-TM2
  const areaOperativa = workOrder.area || '40BU-TM1-TM2';
  
  const infoData = [
    ['CENTRO OPERACION', '40BU-TRONCALES', 'AREA OPERATIVA', areaOperativa],
    ['PROCESO', 'MTTO-PREVENTIVO', 'UBICACION', workOrder.workshop || 'TALLER EL HATO'],
    ['ACTIVO', workOrder.vehicleCode || workOrder.vehicleModel, 'PLACA', workOrder.plate],
    ['FUNCION', 'TRANSPORTE DE PERSONAL', 'TIPO OT', 'S'],
    ['DESCRIPCION CORTA', workOrder.vehicleModel, 'NO. SERIE', workOrder.vin || ''], 
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
  const boxHeight = 35; // Increased height to fit name, position and signature
  if (sigY + boxHeight > 280) { doc.addPage(); sigY = 20; }

  doc.rect(10, sigY, 60, boxHeight); 
  doc.rect(70, sigY, 60, boxHeight); 
  doc.rect(130, sigY, 70, boxHeight); 
  
  doc.setFontSize(6);
  doc.text("RESPONSABLE", 12, sigY + 4);
  doc.text("APROBADOR", 72, sigY + 4);
  doc.text("RECIBE A SATISFACCION", 132, sigY + 4);

  // Si la OT está cerrada, incluir firmas electrónicas
  if (workOrder.signatures) {
    // Firma RESPONSABLE
    if (workOrder.signatures.responsible) {
      const sig = workOrder.signatures.responsible;
      if (typeof sig === 'object') {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(sig.name || '', 12, sigY + 8);
        
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text(sig.position || '', 12, sigY + 11);
        
        if (sig.image) {
          doc.addImage(sig.image, 'PNG', 12, sigY + 13, 56, 20);
        }
      } else {
        doc.addImage(sig, 'PNG', 12, sigY + 6, 56, 12);
      }
    }
    
    // APROBADOR (nombre en texto)
    if (workOrder.signatures.approver) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(workOrder.signatures.approver, 100, sigY + (boxHeight / 2), { align: 'center' });
    }
    
    // Firma RECIBE A SATISFACCIÓN
    if (workOrder.signatures.received) {
      const sig = workOrder.signatures.received;
      if (typeof sig === 'object') {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(sig.name || '', 132, sigY + 8);
        
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text(sig.position || '', 132, sigY + 11);
        
        if (sig.image) {
          doc.addImage(sig.image, 'PNG', 132, sigY + 13, 66, 20);
        }
      } else {
        doc.addImage(sig, 'PNG', 132, sigY + 6, 66, 12);
      }
    }
  }

  doc.save(`OT-${workOrder.id}-${workOrder.plate}.pdf`);
};

// --- Components ---

const Dashboard = ({ fleet, workOrders, variableHistory }) => {
  // Calcular métricas
  const metrics = useMemo(() => {
    const totalVehicles = fleet.length;
    const operative = fleet.filter(v => v.status === 'OPERATIVO').length;
    const inMaintenance = fleet.filter(v => v.status === 'MANTENIMIENTO').length;
    const outOfService = fleet.filter(v => v.status === 'FUERA DE SERVICIO').length;
    
    const openOTs = workOrders.filter(ot => ot.status === 'ABIERTA').length;
    const closedOTs = workOrders.filter(ot => ot.status === 'CERRADA').length;
    const totalOTs = workOrders.length;
    
    // Calcular vehículos por estado de mantenimiento
    const needsMaintenance = fleet.filter(v => {
      const nextRoutine = getNextRoutine(v.mileage, v.model);
      const kmSinceLastMtto = v.mileage - (v.lastMaintenance || 0);
      const kmRemaining = nextRoutine.km - kmSinceLastMtto;
      return kmRemaining < 0; // Vencido
    }).length;
    
    const soonMaintenance = fleet.filter(v => {
      const nextRoutine = getNextRoutine(v.mileage, v.model);
      const kmSinceLastMtto = v.mileage - (v.lastMaintenance || 0);
      const kmRemaining = nextRoutine.km - kmSinceLastMtto;
      return kmRemaining >= 0 && kmRemaining < 3000; // Próximo
    }).length;
    
    // Calcular vehículos en rango de ejecución (±10% de la rutina)
    const inExecutionRange = fleet.filter(v => {
      const nextRoutine = getNextRoutine(v.mileage, v.model);
      const kmSinceLastMtto = v.mileage - (v.lastMaintenance || 0);
      const targetKm = nextRoutine.km;
      const rangeMin = targetKm * 0.9; // -10%
      const rangeMax = targetKm * 1.1; // +10%
      return kmSinceLastMtto >= rangeMin && kmSinceLastMtto <= rangeMax;
    }).length;
    
    const outOfRange = totalVehicles - inExecutionRange;
    const rangeCompliance = totalVehicles > 0 ? ((inExecutionRange / totalVehicles) * 100).toFixed(1) : 0;
    
    return {
      totalVehicles,
      operative,
      inMaintenance,
      outOfService,
      openOTs,
      closedOTs,
      totalOTs,
      needsMaintenance,
      soonMaintenance,
      inExecutionRange,
      outOfRange,
      rangeCompliance,
      operativePercentage: totalVehicles > 0 ? ((operative / totalVehicles) * 100).toFixed(1) : 0,
      completionRate: totalOTs > 0 ? ((closedOTs / totalOTs) * 100).toFixed(1) : 0
    };
  }, [fleet, workOrders]);
  
  // Datos para gráfico de estado de flota
  const fleetStatusData = [
    { name: 'Operativos', value: metrics.operative, color: '#10b981' },
    { name: 'En Mantenimiento', value: metrics.inMaintenance, color: '#f59e0b' },
    { name: 'Fuera de Servicio', value: metrics.outOfService, color: '#ef4444' }
  ];
  
  // Datos para gráfico de mantenimientos
  const maintenanceStatusData = [
    { name: 'Vencido', value: metrics.needsMaintenance, color: '#ef4444' },
    { name: 'Próximo', value: metrics.soonMaintenance, color: '#f59e0b' },
    { name: 'OK', value: metrics.totalVehicles - metrics.needsMaintenance - metrics.soonMaintenance, color: '#10b981' }
  ];
  
  // Datos para gráfico de OTs por mes
  const otsByMonth = useMemo(() => {
    const monthCounts = {};
    workOrders.forEach(ot => {
      if (ot.creationDate) {
        const month = ot.creationDate.substring(0, 7); // YYYY-MM
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      }
    });
    
    return Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Últimos 6 meses
      .map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
        total: count,
        abiertas: workOrders.filter(ot => ot.creationDate?.startsWith(month) && ot.status === 'ABIERTA').length,
        cerradas: workOrders.filter(ot => ot.creationDate?.startsWith(month) && ot.status === 'CERRADA').length
      }));
  }, [workOrders]);
  
  // Top 5 vehículos con más kilometraje
  const topMileageVehicles = useMemo(() => {
    return [...fleet]
      .sort((a, b) => b.mileage - a.mileage)
      .slice(0, 5)
      .map(v => ({
        name: v.code,
        km: v.mileage
      }));
  }, [fleet]);

  // Efectividad por taller
  const workshopEffectiveness = useMemo(() => {
    const workshops = ['TALLER EL HATO', 'TALLER PR 33', 'TALLER EL BURRO', 'TALLER EXTERNO'];
    
    return workshops.map(workshop => {
      const workshopOTs = workOrders.filter(ot => ot.workshop === workshop);
      const total = workshopOTs.length;
      const closed = workshopOTs.filter(ot => ot.status === 'CERRADA').length;
      const open = workshopOTs.filter(ot => ot.status === 'ABIERTA').length;
      const effectiveness = total > 0 ? ((closed / total) * 100).toFixed(1) : 0;
      
      return {
        name: workshop.replace('TALLER ', ''),
        total,
        cerradas: closed,
        abiertas: open,
        efectividad: parseFloat(effectiveness)
      };
    }).filter(w => w.total > 0); // Solo mostrar talleres con OTs
  }, [workOrders]);

  // Datos para gráfico de rango de ejecución
  const executionRangeData = [
    { name: 'En Rango (±10%)', value: metrics.inExecutionRange, color: '#10b981' },
    { name: 'Fuera de Rango', value: metrics.outOfRange, color: '#ef4444' }
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <LayoutDashboard className="text-blue-600" size={32} />
            Dashboard de Gestión de Mantenimiento
          </h1>
          <p className="text-slate-600 mt-1">Vista general de métricas y tendencias</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500">Última actualización</div>
          <div className="text-lg font-bold text-slate-700">
            {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Vehículos */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Vehículos</p>
              <h3 className="text-4xl font-bold mt-2">{metrics.totalVehicles}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <Car size={32} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <TrendingUp size={16} />
            <span>{metrics.operativePercentage}% operativos</span>
          </div>
        </div>

        {/* OTs Activas */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">OTs Abiertas</p>
              <h3 className="text-4xl font-bold mt-2">{metrics.openOTs}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <ClipboardList size={32} />
            </div>
          </div>
          <div className="mt-4 text-sm">
            De {metrics.totalOTs} totales ({metrics.completionRate}% cerradas)
          </div>
        </div>

        {/* Mantenimientos Vencidos */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Mtto Vencido</p>
              <h3 className="text-4xl font-bold mt-2">{metrics.needsMaintenance}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <AlertTriangle size={32} />
            </div>
          </div>
          <div className="mt-4 text-sm">
            Requieren atención inmediata
          </div>
        </div>

        {/* Próximos Mantenimientos */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Mtto Próximo</p>
              <h3 className="text-4xl font-bold mt-2">{metrics.soonMaintenance}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <Clock size={32} />
            </div>
          </div>
          <div className="mt-4 text-sm">
            Menos de 3,000 KM restantes
          </div>
        </div>

        {/* Rango de Ejecución */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">En Rango ±10%</p>
              <h3 className="text-4xl font-bold mt-2">{metrics.inExecutionRange}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <Activity size={32} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <CheckCircle size={16} />
            <span>{metrics.rangeCompliance}% de cumplimiento</span>
          </div>
        </div>
      </div>

      {/* KPIs Detallados en Tiempo Real */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Costo Promedio - Placeholder */}
        <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-600">Disponibilidad Flota</p>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {((fleet.filter(v => v.status === 'Activo').length / fleet.length) * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {fleet.filter(v => v.status === 'Activo').length} de {fleet.length} vehículos
          </p>
        </div>

        {/* Kilometraje Total */}
        <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-600">KM Total Flota</p>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {fleet.reduce((sum, v) => sum + (v.currentKm || 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Promedio: {fleet.length > 0 ? Math.round(fleet.reduce((sum, v) => sum + (v.currentKm || 0), 0) / fleet.length).toLocaleString() : 0} KM
          </p>
        </div>

        {/* OT Completadas */}
        <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-600">Tasa Cumplimiento</p>
            <CheckCircle className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {metrics.completionRate}%
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {workOrders.filter(ot => ot.status === 'completed').length} OT completadas
          </p>
        </div>

        {/* Alertas Activas */}
        <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-600">Alertas Críticas</p>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {metrics.needsMaintenance + metrics.soonMaintenance}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {metrics.needsMaintenance} vencidos, {metrics.soonMaintenance} próximos
          </p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado de Flota - Pie Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <PieChart className="text-blue-600" />
            Estado de la Flota
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={fleetStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {fleetStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>

        {/* Estado de Mantenimiento - Donut */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="text-blue-600" />
            Estado de Mantenimiento
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={maintenanceStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {maintenanceStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OTs por Mes - Area Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="text-blue-600" />
            Órdenes de Trabajo - Últimos 6 Meses
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={otsByMonth}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorAbiertas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorCerradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" name="Total OTs" strokeWidth={2} />
              <Area type="monotone" dataKey="cerradas" stroke="#6366f1" fillOpacity={1} fill="url(#colorCerradas)" name="Cerradas" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top 5 Kilometraje - Bar Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="text-blue-600" />
            Top 5 - Mayor Kilometraje
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topMileageVehicles} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis dataKey="name" type="category" stroke="#64748b" style={{ fontSize: '12px' }} width={80} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value) => [`${value.toLocaleString()} KM`, 'Kilometraje']}
              />
              <Bar dataKey="km" fill="#3b82f6" radius={[0, 8, 8, 0]}>
                {topMileageVehicles.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(${220 - index * 10}, 80%, ${50 + index * 5}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3 - Rango de Ejecución y Efectividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rango de Ejecución - Donut Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="text-purple-600" />
            Cumplimiento de Rango de Ejecución (±10%)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={executionRangeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {executionRangeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600">
              Los vehículos deben ejecutar mantenimiento entre <strong>-10%</strong> y <strong>+10%</strong> del kilometraje programado
            </p>
          </div>
        </div>

        {/* Efectividad por Taller - Bar Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Wrench className="text-blue-600" />
            Efectividad por Taller
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workshopEffectiveness}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                style={{ fontSize: '11px' }}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#64748b" 
                style={{ fontSize: '12px' }}
                label={{ value: '% Efectividad', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value, name) => {
                  if (name === 'efectividad') return [`${value}%`, 'Efectividad'];
                  return [value, name.charAt(0).toUpperCase() + name.slice(1)];
                }}
              />
              <Legend />
              <Bar dataKey="cerradas" fill="#10b981" name="OTs Cerradas" radius={[8, 8, 0, 0]} />
              <Bar dataKey="abiertas" fill="#f59e0b" name="OTs Abiertas" radius={[8, 8, 0, 0]} />
              <Bar dataKey="efectividad" fill="#3b82f6" name="% Efectividad" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600">
              Efectividad = (OTs Cerradas / Total OTs) × 100
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tasa de Operatividad</p>
              <p className="text-2xl font-bold text-slate-800">{metrics.operativePercentage}%</p>
            </div>
            <CheckCircle className="text-blue-500" size={32} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tasa de Cierre OTs</p>
              <p className="text-2xl font-bold text-slate-800">{metrics.completionRate}%</p>
            </div>
            <Activity className="text-green-500" size={32} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Cumplimiento Rango</p>
              <p className="text-2xl font-bold text-slate-800">{metrics.rangeCompliance}%</p>
            </div>
            <TrendingUp className="text-purple-500" size={32} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Vehículos en Atención</p>
              <p className="text-2xl font-bold text-slate-800">{metrics.inMaintenance}</p>
            </div>
            <Wrench className="text-amber-500" size={32} />
          </div>
        </div>
      </div>
    </div>
  );
};

const PlanningView = ({ fleet, setFleet, onCreateOT, workOrders = [], setWorkOrders, variableHistory = [], setVariableHistory, routines = MAINTENANCE_ROUTINES, currentUser }) => {
  const dialog = useDialog();
  const alert = useCallback(
    (message, options = {}) => {
      const title = options.title || 'Mensaje';
      const variant = options.variant || 'info';
      return dialog.alert({ title, message: String(message ?? ''), variant });
    },
    [dialog]
  );
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [workshop, setWorkshop] = useState('');
  const [viewingHistoryVehicle, setViewingHistoryVehicle] = useState(null);
  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);
  const [showManualUpdate, setShowManualUpdate] = useState(false);
  const [showGanttChart, setShowGanttChart] = useState(false);
  const [showBulkLoad, setShowBulkLoad] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, VENCIDO, PROXIMO, OK
  const [closingOT, setClosingOT] = useState(null);
  
  // Estado para edición inline
  const [editingCell, setEditingCell] = useState(null); // { vehicleId, field }
  const [editValue, setEditValue] = useState('');
  
  const [columnFilters, setColumnFilters] = useState({
    code: '',
    plate: '',
    model: '',
    variable: '',
    lastMaintenance: '',
    nextRoutine: ''
  });
  const [activeFilters, setActiveFilters] = useState({
    code: false,
    plate: false,
    model: false,
    variable: false,
    lastMaintenance: false,
    nextRoutine: false
  });

  // Handler para doble clic en celda editable
  const handleCellDoubleClick = (vehicleId, field, currentValue) => {
    setEditingCell({ vehicleId, field });
    setEditValue(currentValue || '');
  };

  // Handler para guardar cambio de celda
  const handleCellSave = (vehicleId, field) => {
    const vehicleIndex = fleet.findIndex(v => v.id === vehicleId);
    if (vehicleIndex === -1) return;

    const newFleet = [...fleet];
    
    if (field === 'lastMaintenance') {
      const newValue = parseInt(editValue.replace(/[^\d]/g, '')) || 0;
      newFleet[vehicleIndex] = {
        ...newFleet[vehicleIndex],
        lastMaintenance: newValue
      };
    } else if (field === 'lastMaintenanceDate') {
      newFleet[vehicleIndex] = {
        ...newFleet[vehicleIndex],
        lastMaintenanceDate: editValue || null
      };
    }

    setFleet(newFleet);
    localStorage.setItem('fleet_data', JSON.stringify(newFleet));
    setEditingCell(null);
    setEditValue('');
  };

  // Handler para cancelar edición
  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handler para teclas en edición
  const handleCellKeyDown = (e, vehicleId, field) => {
    if (e.key === 'Enter') {
      handleCellSave(vehicleId, field);
    } else if (e.key === 'Escape') {
      handleCellCancel();
    }
  };

  // Estado para edición completa de vehículo
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleEditData, setVehicleEditData] = useState({});

  // Abrir modal de edición
  const handleRowClick = (vehicle) => {
    // Obtener la última fecha de variable del historial
    const lastVarEntry = variableHistory
      .filter(v => v.code === vehicle.code || v.plate === vehicle.plate)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    
    setEditingVehicle(vehicle);
    setVehicleEditData({
      code: vehicle.code || '',
      plate: vehicle.plate || '',
      model: vehicle.model || '',
      brand: vehicle.brand || '',
      year: vehicle.year || new Date().getFullYear(),
      mileage: vehicle.mileage || 0,
      lastVariableDate: lastVarEntry?.date || '',
      lastMaintenance: vehicle.lastMaintenance || 0,
      lastMaintenanceDate: vehicle.lastMaintenanceDate || '',
      status: vehicle.status || 'OPERATIVO',
      driver: vehicle.driver || 'PENDIENTE',
      vin: vehicle.vin || '',
      area: vehicle.area || ''
    });
  };

  // Guardar edición completa
  const handleVehicleEditSave = () => {
    if (!editingVehicle) return;
    
    const vehicleIndex = fleet.findIndex(v => v.id === editingVehicle.id);
    if (vehicleIndex === -1) return;

    const newMileage = parseInt(vehicleEditData.mileage) || 0;
    const oldMileage = editingVehicle.mileage || 0;
    const mileageChanged = newMileage !== oldMileage;
    const lastMaintenanceChanged = (parseInt(vehicleEditData.lastMaintenance) || 0) !== (editingVehicle.lastMaintenance || 0);

    const newFleet = [...fleet];
    newFleet[vehicleIndex] = {
      ...newFleet[vehicleIndex],
      mileage: newMileage,
      lastVariableDate: vehicleEditData.lastVariableDate || newFleet[vehicleIndex].lastVariableDate,
      maintenanceCycle: parseInt(vehicleEditData.maintenanceCycle) || newFleet[vehicleIndex].maintenanceCycle || 5000,
      lastMaintenance: parseInt(vehicleEditData.lastMaintenance) || 0,
      lastMaintenanceDate: vehicleEditData.lastMaintenanceDate || newFleet[vehicleIndex].lastMaintenanceDate,
      year: parseInt(vehicleEditData.year) || new Date().getFullYear()
    };

    setFleet(newFleet);
    localStorage.setItem('fleet_data', JSON.stringify(newFleet));

    // Si cambió el kilometraje, registrar en historial de variables
    if (mileageChanged && setVariableHistory) {
      const now = new Date();
      let dateStr = vehicleEditData.lastVariableDate;
      
      // Si no hay fecha o está vacía, usar fecha actual
      if (!dateStr || dateStr.trim() === '') {
        dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      }
      
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      const newRecord = {
        id: Date.now(),
        code: newFleet[vehicleIndex].code,
        plate: newFleet[vehicleIndex].plate,
        date: `${dateStr} ${timeStr}`,
        km: newMileage,
        mileage: newMileage,
        change: newMileage - oldMileage,
        updatedBy: 'Manual',
        source: 'MANUAL_EDIT'
      };
      
      setVariableHistory(prev => {
        const updated = [...prev, newRecord];
        localStorage.setItem('variable_history', JSON.stringify(updated));
        return updated;
      });
    }

    alert(`✅ Datos actualizados correctamente\n${newFleet[vehicleIndex].plate} - ${newFleet[vehicleIndex].code}`);
    setEditingVehicle(null);
    setVehicleEditData({});
  };

  // Handler para cerrar OT con firmas
  const handleCloseOT = async (closedOT) => {
    try {
      // Actualizar en API primero
      await api.updateWorkOrder(closedOT.id, {
        status: closedOT.status,
        closedDate: closedOT.closedDate,
        closedTime: closedOT.closedTime,
        signatures: closedOT.signatures
      });
      
      setWorkOrders(prev => {
        const updated = prev.map(ot => 
          ot.id === closedOT.id ? closedOT : ot
        );
        return updated;
      });
      
      console.log('✅ OT cerrada en BD:', closedOT.id);
    } catch (error) {
      console.error('Error cerrando OT en BD:', error);
      // Fallback: actualizar solo en estado local
      setWorkOrders(prev => {
        const updated = prev.map(ot => 
          ot.id === closedOT.id ? closedOT : ot
        );
        localStorage.setItem('work_orders', JSON.stringify(updated));
        return updated;
      });
    }
    
    setClosingOT(null);
    alert(`✅ OT #${closedOT.otNumber ?? closedOT.id} cerrada exitosamente\n${closedOT.plate} - ${closedOT.vehicleCode || closedOT.code}`);
    
    // Generar PDF con firmas
    generatePDF(closedOT, alert);
  };

  // Helper to get next routine using the passed routines prop
  const getNextRoutineLocal = (mileage, vehicleModel = '', lastMaintenance = 0, maintenanceCycle = null) => {
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

    // Use the specific maintenance cycle if provided, otherwise use the first interval
    const cycle = maintenanceCycle || intervals[0];
    let targetKm;

    // 1. Calculate Target KM - LÓGICA DEL CLIENTE
    if (lastMaintenance > 0) {
        // PRÓXIMO = ÚLTIMO MTTO + CICLO
        targetKm = lastMaintenance + cycle;
    } else {
        // Sin historial: PRÓXIMO = CICLO BASE (no múltiplos)
        // Ejemplo: Si ciclo es 10000 y variable es 17782, próximo es 10000 (desfase -7782)
        targetKm = cycle;
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

  const updateColumnFilter = (column, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const toggleFilter = (column) => {
    setActiveFilters(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
    // Si se desactiva, limpiar el filtro
    if (activeFilters[column]) {
      setColumnFilters(prev => ({
        ...prev,
        [column]: ''
      }));
    }
  };

  const confirmGeneration = async () => {
    if (!selectedVehicle) return;
    
    const routine = getNextRoutineLocal(selectedVehicle.mileage, selectedVehicle.model, selectedVehicle.lastMaintenance, selectedVehicle.maintenanceCycle);

    const workOrder = {
      vehicleCode: selectedVehicle.code,
      vehicleModel: selectedVehicle.model,
      plate: selectedVehicle.plate,
      vin: selectedVehicle.vin || '',
      routineName: `MANTENIMIENTO PREVENTIVO ${routine.km} KM`,
      mileage: selectedVehicle.mileage,
      items: routine.items || [],
      supplies: routine.supplies || [],
      workshop: workshop,
      status: 'ABIERTA',
      creationDate: new Date().toISOString().split('T')[0]
    };

    // 1. Create OT in system (API will handle persistence)
    const savedOT = await onCreateOT(workOrder);
    
    // 2. Generate PDF (use persisted record to include correct id/otNumber)
    generatePDF(savedOT || workOrder, alert);

    // 3. Reset
    setSelectedVehicle(null);
    setWorkshop('');
  };

  const getVehicleHistory = (vehicle) => {
    return workOrders.filter(ot => 
      ot.vehicleCode === vehicle.code || ot.plate === vehicle.plate
    ).sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
  };

  // Helper function to parse dates in DD/MM/YYYY format
  const parseDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return null;
    // Handle formats like "10/12/2025 16:07:50" or "10/12/2025"
    const parts = dateStr.split(' ')[0].split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Month is 0-indexed
      const year = parseInt(parts[2]);
      return new Date(year, month, day);
    }
    // Fallback to standard parsing
    return new Date(dateStr);
  };

  const getLastVariableDate = (vehicle) => {
    // Try to find in history
    const history = variableHistory
      .filter(h => h.code === vehicle.code || h.plate === vehicle.plate)
      .sort((a, b) => new Date(b.date || b.uploadDate) - new Date(a.date || a.uploadDate));
    
    if (history.length > 0) return history[0].date || history[0].uploadDate?.split('T')[0];
    // If no history, return null to indicate no data available
    return null;
  };

  const getLastMaintenanceDate = (vehicle) => {
    // First check if we have it from bulk load
    if (vehicle.lastMaintenanceDate) {
      // Validate that it's actually a date and not a number/kilometraje
      const dateValue = String(vehicle.lastMaintenanceDate);
      // Check if it looks like a date (contains - or / separators)
      if (dateValue.includes('-') || dateValue.includes('/')) {
        return vehicle.lastMaintenanceDate;
      }
      // If it's just a number, it's probably kilometraje incorrectly saved, ignore it
    }
    
    // Fallback: Check closed OTs
    const closedOTs = workOrders
      .filter(ot => (ot.vehicleCode === vehicle.code || ot.plate === vehicle.plate) && ot.status === 'CERRADA')
      .sort((a, b) => new Date(b.closedDate || b.closingDate || 0) - new Date(a.closedDate || a.closingDate || 0));
    
    if (closedOTs.length > 0) return closedOTs[0].closedDate || closedOTs[0].closingDate;
    return "---";
  };

  const weeklyPlan = useMemo(() => {
    // 1. Identify candidates (Remaining < 3000km or Vencido)
    const candidates = pickups.map(v => {
        const next = getNextRoutineLocal(v.mileage, v.model, v.lastMaintenance, v.maintenanceCycle);
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
  }, [pickups, routines, fleet]);

  return (
    <div className="p-6 space-y-6 relative">
      {/* New Maintenance Data Loader Modal */}
      {showManualUpdate && (
        <MaintenanceDataLoader 
          fleet={fleet}
          setFleet={setFleet}
          setVariableHistory={setVariableHistory}
          onClose={() => setShowManualUpdate(false)}
        />
      )}

      {/* Modal for Bulk Load (Plan) - Using New Component */}
      {showBulkLoad && (
        <MaintenanceDataLoader 
          fleet={fleet}
          setFleet={setFleet}
          setVariableHistory={setVariableHistory}
          onClose={() => setShowBulkLoad(false)}
        />
      )}

      {/* Modal for Close OT with Signatures */}
      {closingOT && (
        <CloseOTModal
          workOrder={closingOT}
          currentUser={currentUser}
          onClose={() => setClosingOT(null)}
          onSave={handleCloseOT}
        />
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
                <option value="TALLER PR 33">TALLER PR 33</option>
                <option value="TALLER EL BURRO">TALLER EL BURRO</option>
                <option value="TALLER EXTERNO">TALLER EXTERNO</option>
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
                          disabled={v.remaining >= 3000}
                          className={`mt-2 text-xs px-2 py-1 rounded w-full ${
                            v.remaining >= 3000
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          }`}
                          title={v.remaining >= 3000 ? 'No requiere atención' : 'Generar OT'}
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

      {/* Modal Cronograma Gantt */}
      {showGanttChart && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden">
            {/* Header minimalista */}
            <div className="flex justify-between items-center px-6 py-4 bg-slate-800 text-white">
              <div className="flex items-center gap-4">
                <BarChart3 size={22} />
                <div>
                  <h3 className="text-lg font-semibold">Cronograma de Ejecución</h3>
                  <p className="text-xs text-slate-400">Historial y proyección de mantenimientos preventivos</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium flex items-center gap-1.5 transition-colors">
                  <Download size={14} /> Exportar
                </button>
                <button 
                  onClick={() => setShowGanttChart(false)} 
                  className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              {/* Tabla estilo ROOMS RACK */}
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse min-w-max">
                  <thead className="sticky top-0 z-20">
                    {/* Fila de encabezados PM */}
                    <tr className="bg-slate-700 text-white text-[11px]">
                      <th className="py-2 px-3 text-left font-semibold border-r border-slate-600 sticky left-0 bg-slate-700 z-30 min-w-[100px]">VEHÍCULO</th>
                      <th className="py-2 px-2 text-center font-semibold border-r border-slate-600 min-w-[70px]">VARIABLE</th>
                      <th className="py-2 px-2 text-center font-semibold border-r border-slate-600 min-w-[55px]">CICLO</th>
                      <th className="py-2 px-2 text-center font-semibold border-r border-slate-600 min-w-[60px]">ÚLT.MTTO</th>
                      {Array.from({ length: 6 }, (_, i) => (
                        <th key={i} className="py-2 px-1 text-center font-semibold border-r border-slate-600 min-w-[70px]">
                          PM{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[11px]">
                    {pickups.slice(0, 40).map((vehicle, idx) => {
                      const cycle = vehicle.maintenanceCycle || 5000;
                      const currentMileage = vehicle.mileage || 0;
                      const lastMaintenance = vehicle.lastMaintenance || 0;
                      
                      // Calcular el número de PM ejecutado basado en lastMaintenance
                      const completedPMs = lastMaintenance > 0 ? Math.floor(lastMaintenance / cycle) : 0;
                      
                      // Calcular próximo PM
                      const nextPMNumber = completedPMs + 1;
                      const nextPMKm = nextPMNumber * cycle;
                      
                      // Verificar si está vencido (solo el próximo PM puede estar vencido)
                      const isNextOverdue = currentMileage >= nextPMKm;
                      
                      // Generar los 6 PMs a mostrar (3 ejecutados + 3 futuros aproximadamente)
                      const startPM = Math.max(1, completedPMs - 2);
                      const pms = [];
                      for (let i = 0; i < 6; i++) {
                        const pmNum = startPM + i;
                        const targetKm = pmNum * cycle;
                        const isExecuted = pmNum <= completedPMs;
                        const isNext = pmNum === nextPMNumber;
                        const isOverdue = isNext && isNextOverdue;
                        
                        pms.push({
                          num: pmNum,
                          targetKm,
                          isExecuted,
                          isNext,
                          isOverdue,
                          executedKm: isExecuted ? (pmNum === completedPMs ? lastMaintenance : targetKm) : null
                        });
                      }
                      
                      return (
                        <tr key={vehicle.id} className={`border-b border-slate-100 hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                          {/* Columna Vehículo */}
                          <td className="py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-inherit z-10">
                            <div className="flex flex-col leading-tight">
                              <span className="font-bold text-slate-800 text-[11px]">{vehicle.plate}</span>
                              <span className="text-[9px] text-slate-400">{vehicle.code}</span>
                            </div>
                          </td>
                          {/* Variable */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200">
                            <span className="font-bold text-blue-600">{currentMileage.toLocaleString()}</span>
                          </td>
                          {/* Ciclo */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200 text-slate-500">
                            {cycle.toLocaleString()}
                          </td>
                          {/* Último Mtto */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200">
                            <span className={`font-medium ${lastMaintenance > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                              {lastMaintenance > 0 ? lastMaintenance.toLocaleString() : '—'}
                            </span>
                          </td>
                          {/* PMs dinámicos */}
                          {pms.map((pm) => (
                            <td key={pm.num} className={`py-1 px-1 text-center border-r border-slate-200 ${
                              pm.isExecuted ? 'bg-emerald-50' : 
                              pm.isOverdue ? 'bg-red-50' : 
                              pm.isNext ? 'bg-amber-50' : 
                              ''
                            }`}>
                              <div className="flex flex-col items-center leading-tight">
                                {pm.isExecuted ? (
                                  <CheckCircle2 size={14} className="text-emerald-500" />
                                ) : pm.isOverdue ? (
                                  <AlertCircle size={14} className="text-red-500" />
                                ) : pm.isNext ? (
                                  <Clock size={14} className="text-amber-500" />
                                ) : (
                                  <Circle size={12} className="text-slate-300" />
                                )}
                                <span className={`text-[9px] font-medium ${
                                  pm.isExecuted ? 'text-emerald-700' : 
                                  pm.isOverdue ? 'text-red-700' : 
                                  pm.isNext ? 'text-amber-700' : 
                                  'text-slate-400'
                                }`}>
                                  {pm.isExecuted && pm.executedKm ? pm.executedKm.toLocaleString() : pm.targetKm.toLocaleString()}
                                </span>
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer con leyenda */}
              <div className="bg-white border-t border-slate-200 px-6 py-2.5 flex items-center gap-6 text-xs">
                <span className="font-semibold text-slate-700">Estados:</span>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span className="text-slate-600">Ejecutado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-red-500" />
                  <span className="text-slate-600">Vencido</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-500" />
                  <span className="text-slate-600">Próximo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Circle size={14} className="text-slate-300" />
                  <span className="text-slate-600">Futuro</span>
                </div>
              </div>
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
                        <td className="p-2 font-mono text-blue-600">#{ot.otNumber ?? ot.id}</td>
                        <td className="p-2">{ot.routineName}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            ot.status === 'ABIERTA' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {ot.status}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => generatePDF(ot, alert)}
                              className="text-slate-600 hover:text-blue-600"
                              title="Descargar PDF"
                            >
                              <FileText size={16} />
                            </button>
                            {ot.status === 'ABIERTA' && (
                              <button
                                onClick={() => setClosingOT(ot)}
                                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors font-medium"
                                title="Cerrar OT"
                              >
                                Cerrar
                              </button>
                            )}
                          </div>
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

      {/* Modal de Edición de Variables y Mantenimiento */}
      {editingVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Actualizar Variable y Mantenimiento</h3>
                <p className="text-sm text-slate-500">{editingVehicle.code} - {editingVehicle.plate} - {editingVehicle.model}</p>
              </div>
              <button 
                onClick={() => { setEditingVehicle(null); setVehicleEditData({}); }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* SECCIÓN VARIABLES - Verde */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="text-sm font-bold text-green-800 mb-3">📊 Variables Actuales</h4>
                
                {/* Kilometraje Actual (Variable) */}
                <div className="mb-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kilometraje Actual (KM)</label>
                  <input
                    type="number"
                    value={vehicleEditData.mileage || ''}
                    onChange={(e) => setVehicleEditData({...vehicleEditData, mileage: e.target.value})}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    placeholder="Ej: 222557"
                  />
                </div>
                
                {/* Fecha de la Variable */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Variable (DD/MM/YYYY)</label>
                  <input
                    type="text"
                    value={vehicleEditData.lastVariableDate || ''}
                    onChange={(e) => setVehicleEditData({...vehicleEditData, lastVariableDate: e.target.value})}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    placeholder="Ej: 16/12/2025"
                  />
                </div>
              </div>

              {/* SECCIÓN CICLO - Azul */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="text-sm font-bold text-blue-800 mb-3">🔄 Ciclo de Mantenimiento</h4>
                
                {/* Ciclo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ciclo (KM)</label>
                  <select
                    value={vehicleEditData.maintenanceCycle || 5000}
                    onChange={(e) => setVehicleEditData({...vehicleEditData, maintenanceCycle: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="5000">5,000 KM</option>
                    <option value="7000">7,000 KM</option>
                    <option value="10000">10,000 KM</option>
                  </select>
                </div>
              </div>
              
              {/* SECCIÓN MANTENIMIENTO - Amarillo */}
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="text-sm font-bold text-yellow-800 mb-3">🔧 Último Mantenimiento</h4>
                
                {/* Último Mtto KM */}
                <div className="mb-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Último Mtto (KM)</label>
                  <input
                    type="number"
                    value={vehicleEditData.lastMaintenance || ''}
                    onChange={(e) => setVehicleEditData({...vehicleEditData, lastMaintenance: e.target.value})}
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                    placeholder="Ej: 208536"
                  />
                </div>
                
                {/* Fecha Último Mtto */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Último Mtto (DD/MM/YYYY)</label>
                  <input
                    type="text"
                    value={vehicleEditData.lastMaintenanceDate || ''}
                    onChange={(e) => setVehicleEditData({...vehicleEditData, lastMaintenanceDate: e.target.value})}
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                    placeholder="Ej: 24/10/2025"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button 
                onClick={() => { setEditingVehicle(null); setVehicleEditData({}); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleVehicleEditSave}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm"
              >
                💾 Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex justify-end items-center">
          <div className="flex gap-2">
            {/* Menú de carga de variables */}
            <div className="relative">
              <button 
                onClick={() => setShowManualUpdate(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 text-sm flex items-center gap-2 shadow-sm font-medium"
              >
                <Database size={16} /> Actualizar BD-Mtto
              </button>
            </div>
            
            <button 
              onClick={() => setShowWeeklyPlan(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm flex items-center gap-2 shadow-sm"
            >
              <Calendar size={16} /> Planeación Semanal
            </button>
            <button 
              onClick={() => setShowGanttChart(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm flex items-center gap-2 shadow-sm"
            >
              <BarChart3 size={16} /> Cronograma de Ejecución
            </button>
            <button className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700 text-sm flex items-center gap-2 shadow-sm">
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
            const nextRoutine = getNextRoutineLocal(v.mileage, v.model, v.lastMaintenance, v.maintenanceCycle);
            const kmRemaining = nextRoutine.km - v.mileage;
            
            // Check if variable is outdated (more than 5 days old or no data)
            const lastVarDate = getLastVariableDate(v);
            let isOutdated = !lastVarDate || v.mileage === 0;
            if (lastVarDate && !isOutdated) {
              // Parse date correctly (DD/MM/YYYY format)
              const varDateObj = parseDateDDMMYYYY(lastVarDate);
              if (varDateObj) {
                varDateObj.setHours(0, 0, 0, 0);
                const fiveDaysAgoDate = new Date(fiveDaysAgo);
                fiveDaysAgoDate.setHours(0, 0, 0, 0);
                isOutdated = varDateObj < fiveDaysAgoDate;
              }
            }
            
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
              <tr className="text-slate-500 text-[10px] uppercase tracking-wide border-b border-slate-200">
                <th className="px-2 py-2 text-left font-semibold w-20 border-r border-slate-100">Estado</th>
                <th className="px-2 py-2 text-center font-semibold w-16 border-r border-slate-100">Falta</th>
                <th className="px-2 py-2 text-left font-semibold border-r border-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span>Código</span>
                    <button
                      onClick={() => toggleFilter('code')}
                      className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${
                        activeFilters.code ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
                      }`}
                      title="Filtrar por código"
                    >
                      <Filter size={12} />
                    </button>
                  </div>
                </th>
                <th className="px-2 py-2 text-left font-semibold border-r border-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span>Placa</span>
                    <button
                      onClick={() => toggleFilter('plate')}
                      className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${
                        activeFilters.plate ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
                      }`}
                      title="Filtrar por placa"
                    >
                      <Filter size={12} />
                    </button>
                  </div>
                </th>
                <th className="px-2 py-2 text-left font-semibold border-r border-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span>Modelo</span>
                    <button
                      onClick={() => toggleFilter('model')}
                      className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${
                        activeFilters.model ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
                      }`}
                      title="Filtrar por modelo"
                    >
                      <Filter size={12} />
                    </button>
                  </div>
                </th>
                <th className="px-2 py-2 text-center font-semibold border-r border-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span>Variable</span>
                    <button
                      onClick={() => toggleFilter('variable')}
                      className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${
                        activeFilters.variable ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
                      }`}
                      title="Filtrar por variable"
                    >
                      <Filter size={12} />
                    </button>
                  </div>
                </th>
                <th className="px-2 py-2 text-center font-semibold border-r border-slate-100">F. Variable</th>
                <th className="px-2 py-2 text-center font-semibold border-r border-slate-100">Ciclo</th>
                <th className="px-2 py-2 text-center font-semibold border-r border-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span>Últ. Mtto</span>
                    <button
                      onClick={() => toggleFilter('lastMaintenance')}
                      className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${
                        activeFilters.lastMaintenance ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
                      }`}
                      title="Filtrar por último mantenimiento"
                    >
                      <Filter size={12} />
                    </button>
                  </div>
                </th>
                <th className="px-2 py-2 text-center font-semibold border-r border-slate-100">F. Últ. Mtto</th>
                <th className="px-2 py-2 text-center font-semibold border-r border-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span>Próx. Rutina</span>
                    <button
                      onClick={() => toggleFilter('nextRoutine')}
                      className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${
                        activeFilters.nextRoutine ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
                      }`}
                      title="Filtrar por próxima rutina"
                    >
                      <Filter size={12} />
                    </button>
                  </div>
                </th>
                <th className="px-2 py-2 text-center font-semibold w-24">Acción</th>
              </tr>
              {/* Filter Row - Only show if any filter is active */}
              {Object.values(activeFilters).some(v => v) && (
                <tr className="bg-white border-b border-slate-200">
                  <th className="px-2 py-2 border-r border-slate-100"></th>
                  <th className="px-2 py-2 border-r border-slate-100"></th>
                  <th className="px-2 py-2 border-r border-slate-100">
                    {activeFilters.code && (
                      <input
                        type="text"
                        placeholder="Buscar código..."
                        value={columnFilters.code}
                        onChange={(e) => updateColumnFilter('code', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    )}
                  </th>
                  <th className="px-2 py-2 border-r border-slate-100">
                    {activeFilters.plate && (
                      <input
                        type="text"
                        placeholder="Buscar placa..."
                        value={columnFilters.plate}
                        onChange={(e) => updateColumnFilter('plate', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    )}
                  </th>
                  <th className="px-2 py-2 border-r border-slate-100">
                    {activeFilters.model && (
                      <input
                        type="text"
                        placeholder="Buscar modelo..."
                        value={columnFilters.model}
                        onChange={(e) => updateColumnFilter('model', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    )}
                  </th>
                  <th className="px-2 py-2 border-r border-slate-100">
                    {activeFilters.variable && (
                      <input
                        type="text"
                        placeholder="KM..."
                        value={columnFilters.variable}
                        onChange={(e) => updateColumnFilter('variable', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    )}
                  </th>
                  <th className="px-2 py-2 border-r border-slate-100"></th>
                  <th className="px-2 py-2 border-r border-slate-100"></th>
                  <th className="px-2 py-2 border-r border-slate-100">
                    {activeFilters.lastMaintenance && (
                      <input
                        type="text"
                        placeholder="KM..."
                        value={columnFilters.lastMaintenance}
                        onChange={(e) => updateColumnFilter('lastMaintenance', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    )}
                  </th>
                  <th className="px-2 py-2 border-r border-slate-100"></th>
                  <th className="px-2 py-2 border-r border-slate-100">
                    {activeFilters.nextRoutine && (
                      <input
                        type="text"
                        placeholder="KM..."
                        value={columnFilters.nextRoutine}
                        onChange={(e) => updateColumnFilter('nextRoutine', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    )}
                  </th>
                  <th className="px-2 py-2"></th>
                </tr>
              )}
            </thead>
            <tbody>
              {pickups
                .map(vehicle => {
                  const nextRoutine = getNextRoutineLocal(vehicle.mileage, vehicle.model, vehicle.lastMaintenance, vehicle.maintenanceCycle);
                  const kmRemaining = nextRoutine.km - vehicle.mileage;
                  
                  // Check if variable is outdated
                  const today = new Date();
                  const fiveDaysAgo = new Date(today);
                  fiveDaysAgo.setDate(today.getDate() - 5);
                  const lastVarDate = getLastVariableDate(vehicle);
                  let isOutdated = !lastVarDate || vehicle.mileage === 0;
                  if (lastVarDate && !isOutdated) {
                    // Parse date correctly (DD/MM/YYYY format)
                    const varDateObj = parseDateDDMMYYYY(lastVarDate);
                    if (varDateObj) {
                      varDateObj.setHours(0, 0, 0, 0);
                      const fiveDaysAgoDate = new Date(fiveDaysAgo);
                      fiveDaysAgoDate.setHours(0, 0, 0, 0);
                      isOutdated = varDateObj < fiveDaysAgoDate;
                    }
                  }
                  
                  return { ...vehicle, nextRoutine, kmRemaining, isOutdated };
                })
                .filter(vehicle => {
                  // Status Filter
                  if (statusFilter !== 'ALL') {
                    if (statusFilter === 'OUTDATED' && !vehicle.isOutdated) return false;
                    if (statusFilter === 'VENCIDO' && vehicle.kmRemaining >= 0) return false;
                    if (statusFilter === 'PROXIMO' && (vehicle.kmRemaining < 0 || vehicle.kmRemaining >= 1000)) return false;
                    if (statusFilter === 'INRANGE' && (vehicle.kmRemaining < 1000 || vehicle.kmRemaining >= 3000)) return false;
                    if (statusFilter === 'OK' && vehicle.kmRemaining < 3000) return false;
                  }
                  
                  // Column Filters
                  if (columnFilters.code && !vehicle.code.toLowerCase().includes(columnFilters.code.toLowerCase())) return false;
                  if (columnFilters.plate && !vehicle.plate.toLowerCase().includes(columnFilters.plate.toLowerCase())) return false;
                  if (columnFilters.model && !vehicle.model.toLowerCase().includes(columnFilters.model.toLowerCase())) return false;
                  if (columnFilters.variable && !vehicle.mileage.toString().includes(columnFilters.variable)) return false;
                  if (columnFilters.lastMaintenance && !vehicle.lastMaintenance.toString().includes(columnFilters.lastMaintenance)) return false;
                  if (columnFilters.nextRoutine && !vehicle.nextRoutine.km.toString().includes(columnFilters.nextRoutine)) return false;
                  
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
                      onClick={() => handleRowClick(vehicle)}
                      title="Clic para editar vehículo"
                    >
                      {/* Estado */}
                      <td className="px-2 py-2 border-r border-slate-100">
                        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${statusColor}`}>
                          {statusText}
                        </span>
                      </td>
                      
                      {/* Falta KM */}
                      <td className={`px-2 py-2 border-r border-slate-100 ${faltaColor}`}>
                        <div className="flex items-center justify-center gap-1">
                          {kmRemaining < 0 && <X size={12} className="text-red-500" />}
                          {kmRemaining >= 0 && kmRemaining < 1000 && <AlertTriangle size={12} className="text-amber-500" />}
                          {kmRemaining >= 1000 && kmRemaining < 3000 && <Clock size={12} className="text-blue-500" />}
                          {kmRemaining >= 3000 && <CheckCircle size={12} className="text-emerald-500" />}
                          <span className="font-mono text-xs font-bold">{kmRemaining.toLocaleString()}</span>
                        </div>
                      </td>
                      
                      {/* Código */}
                      <td className="px-2 py-2 border-r border-slate-100">
                        <span className="font-mono text-[11px] text-slate-600">{vehicle.code}</span>
                      </td>
                      
                      {/* Placa */}
                      <td className="px-2 py-2 text-xs font-semibold text-slate-800 border-r border-slate-100">
                        {vehicle.plate}
                      </td>
                      
                      {/* Modelo */}
                      <td className="px-2 py-2 text-slate-500 text-[10px] truncate max-w-[140px] border-r border-slate-100" title={vehicle.model}>
                        {vehicle.model}
                      </td>
                      
                      {/* Variable Actual */}
                      <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-700 border-r border-slate-100">
                        {vehicle.mileage.toLocaleString()}
                      </td>
                      
                      {/* Fecha Variable */}
                      <td className="px-2 py-2 text-center text-slate-400 text-[10px] border-r border-slate-100">
                        {getLastVariableDate(vehicle) || '—'}
                      </td>
                      
                      {/* Ciclo */}
                      <td className="px-2 py-2 text-center text-xs font-semibold text-slate-700 border-r border-slate-100">
                        {vehicle.maintenanceCycle ? vehicle.maintenanceCycle.toLocaleString() : '—'}
                      </td>
                      
                      {/* Último Mtto KM - EDITABLE con doble clic */}
                      <td 
                        className="px-2 py-2 text-center font-mono text-[11px] text-slate-500 border-r border-slate-100 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => handleCellDoubleClick(vehicle.id, 'lastMaintenance', vehicle.lastMaintenance?.toString() || '')}
                        title="Doble clic para editar"
                      >
                        {editingCell?.vehicleId === vehicle.id && editingCell?.field === 'lastMaintenance' ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, vehicle.id, 'lastMaintenance')}
                            onBlur={() => handleCellSave(vehicle.id, 'lastMaintenance')}
                            className="w-20 px-1 py-0.5 text-center border border-blue-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                            placeholder="KM"
                          />
                        ) : (
                          <span className="hover:text-blue-600">
                            {vehicle.lastMaintenance > 0 ? vehicle.lastMaintenance.toLocaleString() : '—'}
                          </span>
                        )}
                      </td>
                      
                      {/* Fecha Último Mtto - EDITABLE con doble clic */}
                      <td 
                        className="px-2 py-2 text-center text-slate-400 text-[10px] border-r border-slate-100 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => handleCellDoubleClick(vehicle.id, 'lastMaintenanceDate', vehicle.lastMaintenanceDate || '')}
                        title="Doble clic para editar (YYYY-MM-DD)"
                      >
                        {editingCell?.vehicleId === vehicle.id && editingCell?.field === 'lastMaintenanceDate' ? (
                          <input
                            type="date"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, vehicle.id, 'lastMaintenanceDate')}
                            onBlur={() => handleCellSave(vehicle.id, 'lastMaintenanceDate')}
                            className="w-28 px-1 py-0.5 text-center border border-blue-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <span className="hover:text-blue-600">
                            {getLastMaintenanceDate(vehicle)}
                          </span>
                        )}
                      </td>
                      
                      {/* Próxima Rutina */}
                      <td className="px-2 py-2 text-center border-r border-slate-100">
                        <div className="font-mono text-xs font-semibold text-slate-700">{nextRoutine.km.toLocaleString()}</div>
                      </td>
                      
                      {/* Acción */}
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setViewingHistoryVehicle(vehicle); }}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Ver historial"
                          >
                            <History size={14} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRowClick(vehicle); }}
                            className="p-1 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Editar variables"
                          >
                            <Wrench size={14} />
                          </button>
                          <button 
                            onClick={(e) => handleQuickGenerateClick(e, vehicle)}
                            disabled={kmRemaining >= 3000}
                            className={`p-1 rounded transition-colors ${
                              kmRemaining >= 3000 
                                ? 'text-slate-300 cursor-not-allowed' 
                                : 'text-slate-500 hover:text-orange-600 hover:bg-orange-50'
                            }`}
                            title={kmRemaining >= 3000 ? 'No requiere atención' : 'Generar OT'}
                          >
                            <FileText size={14} />
                          </button>

                          {/* Botón directo Cerrar OT - habilitado solo si hay OT abierta */}
                          {(() => {
                            const openOT = workOrders.find(ot =>
                              ot.status === 'ABIERTA' &&
                              (ot.vehicleId === vehicle.id || ot.vehicleCode === vehicle.code || ot.plate === vehicle.plate)
                            );
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openOT) setClosingOT(openOT);
                                }}
                                disabled={!openOT}
                                className={`p-1 rounded transition-colors ${
                                  !openOT
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                                }`}
                                title={openOT ? `Cerrar OT #${openOT.id}` : 'Sin OT abierta'}
                              >
                                <X size={14} />
                              </button>
                            );
                          })()}
                        </div>
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
  const dialog = useDialog();
  const alert = useCallback(
    (message, options = {}) => {
      const title = options.title || 'Mensaje';
      const variant = options.variant || 'info';
      return dialog.alert({ title, message: String(message ?? ''), variant });
    },
    [dialog]
  );
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

  const removeVariant = async () => {
      const ok = await dialog.confirm({
        title: 'Confirmar eliminación',
        message: `¿Eliminar variación para ${activeVariant}?`,
        variant: 'warning',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      });
      if (ok) {
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

const AssetManager = ({ fleet, setFleet, routines = MAINTENANCE_ROUTINES }) => {
  const dialog = useDialog();
  const alert = useCallback(
    (message, options = {}) => {
      const title = options.title || 'Mensaje';
      const variant = options.variant || 'info';
      return dialog.alert({ title, message: String(message ?? ''), variant });
    },
    [dialog]
  );
  const [filter, setFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importData, setImportData] = useState('');
  const [importPreview, setImportPreview] = useState([]);
  const [importMode, setImportMode] = useState('replace'); // 'replace' o 'merge'
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    plate: '',
    model: '',
    year: new Date().getFullYear(),
    mileage: 0,
    status: 'OPERATIVO',
    lastMaintenance: 0,
    driver: 'PENDIENTE',
    assignedRoutine: '', // KM de la rutina asignada
    vin: '' // Número de serie / VIN
  });

  const filteredFleet = fleet.filter(v => 
    v.code.toLowerCase().includes(filter.toLowerCase()) ||
    v.plate.toLowerCase().includes(filter.toLowerCase()) ||
    v.model.toLowerCase().includes(filter.toLowerCase())
  );

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      code: vehicle.code,
      plate: vehicle.plate,
      model: vehicle.model,
      year: vehicle.year,
      mileage: vehicle.mileage,
      status: vehicle.status,
      lastMaintenance: vehicle.lastMaintenance || 0,
      driver: vehicle.driver || 'PENDIENTE',
      assignedRoutine: vehicle.assignedRoutine || '',
      vin: vehicle.vin || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (vehicleId) => {
    const ok = await dialog.confirm({
      title: 'Confirmar eliminación',
      message: '¿Está seguro de eliminar este activo? Esta acción no se puede deshacer.',
      variant: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    setFleet(prev => prev.filter(v => v.id !== vehicleId));
  };

  const handleClearAll = async () => {
    const ok1 = await dialog.confirm({
      title: 'Confirmación requerida',
      message: '⚠️ ¿Está seguro de LIMPIAR TODA LA BASE DE DATOS? Esta acción eliminará todos los activos y NO se puede deshacer.',
      variant: 'danger',
      confirmText: 'Continuar',
      cancelText: 'Cancelar'
    });
    if (!ok1) return;

    const ok2 = await dialog.confirm({
      title: 'Última confirmación',
      message: '⚠️⚠️ ÚLTIMA CONFIRMACIÓN: Se eliminarán todos los activos permanentemente.',
      variant: 'danger',
      confirmText: 'Eliminar todo',
      cancelText: 'Cancelar'
    });
    if (!ok2) return;
    
    try {
      // Delete all vehicles from API
      const vehicles = await api.getVehicles();
      for (const vehicle of vehicles) {
        await api.request(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' });
      }
      
      // Clear local state
      setFleet([]);
      localStorage.removeItem('fleet_data');
      await alert('✅ Base de datos limpiada exitosamente.', { title: 'Listo', variant: 'success' });
    } catch (error) {
      console.error('Error clearing database:', error);
      await alert('❌ Error al limpiar la base de datos. Limpiando estado local...', { title: 'Error', variant: 'danger' });
      setFleet([]);
      localStorage.removeItem('fleet_data');
    }
  };

  const parseImportData = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 1) return [];

    // Detectar si la primera línea es encabezado
    const firstLine = lines[0].toLowerCase();
    const headerKeywords = ['codigo', 'placa', 'modelo', 'año', 'kilometraje', 'estado', 'conductor'];
    const matchCount = headerKeywords.filter(kw => firstLine.includes(kw)).length;
    const hasHeader = matchCount >= 3;
    
    const startIndex = hasHeader ? 1 : 0;
    const headers = hasHeader ? lines[0].split('\t').map(h => h.trim().toLowerCase()) : [];
    const vehicles = [];

    // Helper function to find column index by multiple possible names
    const findColumn = (possibleNames) => {
      if (!hasHeader) return -1; // Si no hay header, usar posiciones fijas
      for (const name of possibleNames) {
        const idx = headers.indexOf(name.toLowerCase());
        if (idx >= 0) return idx;
      }
      return -1;
    };

    for (let i = startIndex; i < lines.length; i++) {
      const values = lines[i].split('\t');
      if (values.length < 3) continue; // Mínimo necesita código, placa, modelo

      const codeIdx = findColumn(['codigo', 'código', 'code']);
      const plateIdx = findColumn(['placa', 'plate']);
      const modelIdx = findColumn(['modelo', 'model']);
      const yearIdx = findColumn(['año', 'ano', 'year']);
      const mileageIdx = findColumn(['kilometraje', 'km', 'mileage', 'odometro']);
      const statusIdx = findColumn(['estado', 'status']);
      const lastMttoIdx = findColumn(['ultimo mtto', 'último mtto', 'last maintenance', 'ultimo mantenimiento']);
      const driverIdx = findColumn(['conductor', 'driver', 'responsable']);
      const vinIdx = findColumn(['vin', 'serie', 'serie chasis', 'numero de serie']);
      const routineIdx = findColumn(['rutina', 'routine', 'rutina asignada']);

      const lastMttoValue = values[lastMttoIdx >= 0 ? lastMttoIdx : 6] || '0';
      const parsedLastMtto = parseInt(String(lastMttoValue).replace(/[^\d]/g, '')) || 0;
      
      const vehicle = {
        code: (values[codeIdx >= 0 ? codeIdx : 0] || '').trim().toUpperCase(),
        plate: (values[plateIdx >= 0 ? plateIdx : 1] || '').trim().toUpperCase(),
        model: (values[modelIdx >= 0 ? modelIdx : 2] || '').trim(),
        year: parseInt(values[yearIdx >= 0 ? yearIdx : 3]) || new Date().getFullYear(),
        mileage: parseInt(values[mileageIdx >= 0 ? mileageIdx : 4]?.replace(/[^\d]/g, '')) || 0,
        status: (values[statusIdx >= 0 ? statusIdx : 5] || 'OPERATIVO').trim().toUpperCase(),
        lastMaintenance: parsedLastMtto,
        driver: (values[driverIdx >= 0 ? driverIdx : 7] || 'PENDIENTE').trim(),
        vin: (values[vinIdx >= 0 ? vinIdx : 8] || '').trim(),
        assignedRoutine: (values[routineIdx >= 0 ? routineIdx : 9] || '').trim(),
        // Asegurar campos adicionales
        brand: '',
        owner: 'PROPIO',
        lastMaintenanceDate: null
      };

      if (vehicle.code && vehicle.plate) {
        vehicles.push(vehicle);
      }
    }

    return vehicles;
  };

  const handleImportPreview = () => {
    const parsed = parseImportData(importData);
    setImportPreview(parsed);
  };

  const handleImportConfirm = async () => {
    if (importPreview.length === 0) {
      alert('No hay datos válidos para importar');
      return;
    }

    let finalFleet;
    
    if (importMode === 'replace') {
      // Reemplazar toda la BD
      const ok = await dialog.confirm({
        title: 'Confirmar reemplazo',
        message: `⚠️ Se reemplazará TODA la base de datos con ${importPreview.length} activos. ¿Continuar?`,
        variant: 'danger',
        confirmText: 'Reemplazar',
        cancelText: 'Cancelar'
      });
      if (!ok) return;
      
      const vehiclesWithIds = importPreview.map((v, idx) => ({
        id: idx + 1,
        ...v
      }));
      finalFleet = vehiclesWithIds;
      setFleet(finalFleet);
    } else {
      // Merge: actualizar existentes y agregar nuevos
      const currentMaxId = fleet.length > 0 ? Math.max(...fleet.map(v => v.id)) : 0;
      let nextId = currentMaxId + 1;
      
      const updatedFleet = [...fleet];
      const newVehicles = [];

      importPreview.forEach(importVehicle => {
        const existingIndex = updatedFleet.findIndex(v => 
          v.code === importVehicle.code || v.plate === importVehicle.plate
        );

        if (existingIndex >= 0) {
          // Actualizar existente
          updatedFleet[existingIndex] = {
            ...updatedFleet[existingIndex],
            ...importVehicle
          };
        } else {
          // Agregar nuevo
          newVehicles.push({
            id: nextId++,
            ...importVehicle
          });
        }
      });

      finalFleet = [...updatedFleet, ...newVehicles];
      setFleet(finalFleet);
    }

    // Guardar inmediatamente en localStorage
    localStorage.setItem('fleet_data', JSON.stringify(finalFleet));
    
    // Reset
    setShowImportModal(false);
    setImportData('');
    setImportPreview([]);
    alert(`✅ Importación exitosa: ${importPreview.length} activos procesados`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImportData(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    if (!formData.code || !formData.plate || !formData.model) {
      alert('Por favor complete los campos obligatorios: Código, Placa y Modelo');
      return;
    }

    if (editingVehicle) {
      // Update existing
      setFleet(prev => prev.map(v => 
        v.id === editingVehicle.id ? { ...v, ...formData } : v
      ));
    } else {
      // Add new
      const newId = fleet.length > 0 ? Math.max(...fleet.map(v => v.id)) + 1 : 1;
      setFleet(prev => [...prev, { id: newId, ...formData }]);
    }

    // Reset
    setShowAddModal(false);
    setEditingVehicle(null);
    setFormData({
      code: '',
      plate: '',
      model: '',
      year: new Date().getFullYear(),
      mileage: 0,
      status: 'OPERATIVO',
      lastMaintenance: 0,
      driver: 'PENDIENTE'
    });
  };

  const handleCancel = () => {
    setShowAddModal(false);
    setEditingVehicle(null);
    setFormData({
      code: '',
      plate: '',
      model: '',
      year: new Date().getFullYear(),
      mileage: 0,
      status: 'OPERATIVO',
      lastMaintenance: 0,
      driver: 'PENDIENTE',
      assignedRoutine: '',
      vin: ''
    });
  };

  return (
    <div className="space-y-4">
      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[600px] max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editingVehicle ? 'Editar Activo' : 'Agregar Nuevo Activo'}
            </h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código *</label>
                  <input 
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="w-full p-2 border rounded text-sm"
                    placeholder="P0BL001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Placa *</label>
                  <input 
                    type="text"
                    value={formData.plate}
                    onChange={(e) => setFormData({...formData, plate: e.target.value})}
                    className="w-full p-2 border rounded text-sm"
                    placeholder="ABC123"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Modelo *</label>
                <input 
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="CAMIONETA DOBLE CABINA"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Año</label>
                  <input 
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estado</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full p-2 border rounded text-sm"
                  >
                    <option value="OPERATIVO">OPERATIVO</option>
                    <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                    <option value="FUERA DE SERVICIO">FUERA DE SERVICIO</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kilometraje Actual</label>
                  <input 
                    type="number"
                    value={formData.mileage}
                    onChange={(e) => setFormData({...formData, mileage: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Último Mtto (KM)</label>
                  <input 
                    type="number"
                    value={formData.lastMaintenance}
                    onChange={(e) => setFormData({...formData, lastMaintenance: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número de Serie / VIN</label>
                <input 
                  type="text"
                  value={formData.vin}
                  onChange={(e) => setFormData({...formData, vin: e.target.value})}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="VIN o número de chasis"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rutina de Mantenimiento Asignada</label>
                <select 
                  value={formData.assignedRoutine}
                  onChange={(e) => setFormData({...formData, assignedRoutine: e.target.value})}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option value="">Sin rutina específica (usar por defecto)</option>
                  {Object.keys(routines).sort((a, b) => Number(a) - Number(b)).map(km => (
                    <option key={km} value={km}>
                      {Number(km).toLocaleString()} KM - {routines[km].name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Si se asigna una rutina, el activo usará este plan específico en lugar del ciclo automático
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Conductor/Responsable</label>
                <input 
                  type="text"
                  value={formData.driver}
                  onChange={(e) => setFormData({...formData, driver: e.target.value})}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="Nombre del conductor"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={handleCancel}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm"
              >
                {editingVehicle ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[900px] max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Upload className="text-green-600" /> Importar Activos desde Excel
            </h3>
            
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
              <h4 className="font-bold text-blue-900 mb-2">📋 Instrucciones:</h4>
              <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                <li>Copia los datos desde Excel (incluye la fila de encabezados)</li>
                <li>Pega en el área de texto abajo</li>
                <li>O selecciona un archivo CSV/TXT con datos separados por tabulaciones</li>
                <li>Formato esperado: <code className="bg-blue-100 px-1">Codigo | Placa | Modelo | Año | Kilometraje | Estado | Ultimo Mtto | Conductor | VIN | Rutina</code></li>
                <li>Click en "Vista Previa" para validar antes de importar</li>
              </ol>
            </div>

            {/* Import Mode */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">Modo de Importación:</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    <strong>Reemplazar</strong> - Borra toda la BD actual y carga los nuevos datos
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    <strong>Combinar</strong> - Actualiza existentes y agrega nuevos (por código/placa)
                  </span>
                </label>
              </div>
            </div>

            {/* File Upload */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">Cargar desde archivo:</label>
              <input 
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="w-full p-2 border rounded text-sm"
              />
            </div>

            {/* Text Area */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">O pegar datos aquí:</label>
              <textarea 
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Codigo&#9;Placa&#9;Modelo&#9;Año&#9;Kilometraje&#9;Estado&#9;Ultimo Mtto&#9;Conductor&#9;VIN&#9;Rutina&#10;PVHC001&#9;H1234-1&#9;CAMIONETA RAM&#9;2023&#9;45000&#9;OPERATIVO&#9;40000&#9;JUAN PEREZ&#9;VIN123456&#9;5000"
                className="w-full p-3 border rounded text-xs font-mono h-40"
              />
            </div>

            {/* Preview Button */}
            <div className="flex gap-2 mb-4">
              <button 
                onClick={handleImportPreview}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                disabled={!importData.trim()}
              >
                📊 Vista Previa
              </button>
              {importPreview.length > 0 && (
                <div className="text-sm text-green-600 flex items-center gap-2">
                  ✅ {importPreview.length} activos listos para importar
                </div>
              )}
              <button 
                onClick={() => setShowBulkImport(true)}
                className="ml-auto bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
              >
                <FileText size={16} />
                Importación Masiva
              </button>
            </div>

            {/* Preview Table */}
            {importPreview.length > 0 && (
              <div className="mb-4 border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left">Código</th>
                      <th className="px-2 py-2 text-left">Placa</th>
                      <th className="px-2 py-2 text-left">Modelo</th>
                      <th className="px-2 py-2 text-center">Año</th>
                      <th className="px-2 py-2 text-center">KM</th>
                      <th className="px-2 py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((v, idx) => (
                      <tr key={idx} className="border-t hover:bg-slate-50">
                        <td className="px-2 py-2">{v.code}</td>
                        <td className="px-2 py-2">{v.plate}</td>
                        <td className="px-2 py-2">{v.model}</td>
                        <td className="px-2 py-2 text-center">{v.year}</td>
                        <td className="px-2 py-2 text-center">{v.mileage}</td>
                        <td className="px-2 py-2 text-center">{v.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  setImportData('');
                  setImportPreview([]);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleImportConfirm}
                disabled={importPreview.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold text-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                ✅ Confirmar Importación ({importPreview.length} activos)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por código, placa o modelo..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowBulkImport(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium flex items-center gap-2 shadow-lg"
          >
            <FileText size={16} /> Importar Excel
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm flex items-center gap-2"
          >
            <Plus size={16} /> Agregar Activo
          </button>
          <button 
            onClick={() => setShowImportModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm flex items-center gap-2"
          >
            <Upload size={16} /> Importar Datos
          </button>
          <button 
            onClick={handleClearAll}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm flex items-center gap-2"
          >
            <X size={16} /> Limpiar BD
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="text-xs text-slate-500">Total Activos</div>
          <div className="text-2xl font-bold text-slate-800">{fleet.length}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
          <div className="text-xs text-green-600">Operativos</div>
          <div className="text-2xl font-bold text-green-700">
            {fleet.filter(v => v.status === 'OPERATIVO').length}
          </div>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg shadow-sm border border-amber-200">
          <div className="text-xs text-amber-600">En Mantenimiento</div>
          <div className="text-2xl font-bold text-amber-700">
            {fleet.filter(v => v.status === 'MANTENIMIENTO').length}
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200">
          <div className="text-xs text-red-600">Fuera de Servicio</div>
          <div className="text-2xl font-bold text-red-700">
            {fleet.filter(v => v.status === 'FUERA DE SERVICIO').length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-slate-600 text-xs uppercase">
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Placa</th>
                <th className="px-4 py-3 text-left">Modelo</th>
                <th className="px-4 py-3 text-center">Año</th>
                <th className="px-4 py-3 text-center">KM Actual</th>
                <th className="px-4 py-3 text-center">Último Mtto</th>
                <th className="px-4 py-3 text-center">Rutina Asignada</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Conductor</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredFleet.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{vehicle.code}</td>
                  <td className="px-4 py-3 font-semibold">{vehicle.plate}</td>
                  <td className="px-4 py-3 text-xs">{vehicle.model}</td>
                  <td className="px-4 py-3 text-center">{vehicle.year}</td>
                  <td className="px-4 py-3 text-center font-mono">{vehicle.mileage.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center font-mono">
                    {vehicle.lastMaintenance > 0 ? vehicle.lastMaintenance.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {vehicle.assignedRoutine ? (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                        {Number(vehicle.assignedRoutine).toLocaleString()} KM
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Auto</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      vehicle.status === 'OPERATIVO' ? 'bg-green-100 text-green-700' :
                      vehicle.status === 'MANTENIMIENTO' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{vehicle.driver}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(vehicle)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Editar"
                      >
                        <Wrench size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(vehicle.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Eliminar"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredFleet.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Database size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No se encontraron activos</p>
          <p className="text-sm">Agregue un nuevo activo para comenzar</p>
        </div>
      )}

      {/* Bulk Import Modal - Importación Masiva desde Excel */}
      {showBulkImport && (
        <BulkImportGrid 
          onClose={() => setShowBulkImport(false)}
          onConfirmImport={async (vehicles) => {
            try {
              // Calcular IDs únicos para todos los vehículos
              const currentMaxId = fleet.length > 0 ? Math.max(...fleet.map(v => v.id)) : 0;
              const newVehicles = vehicles.map((v, idx) => ({
                ...v,
                id: currentMaxId + idx + 1
              }));
              
              // Actualizar fleet de inmediato
              const updatedFleet = [...fleet, ...newVehicles];
              setFleet(updatedFleet);
              
              // Guardar en localStorage inmediatamente
              localStorage.setItem('fleet_data', JSON.stringify(updatedFleet));
              
              // Intentar guardar en API en segundo plano
              for (const vehicle of newVehicles) {
                try {
                  await api.createVehicle(vehicle);
                } catch (apiError) {
                  console.warn('API error (datos guardados localmente):', apiError);
                }
              }
              
              alert(`✅ ${vehicles.length} activos importados exitosamente`);
            } catch (error) {
              console.error('Error al importar:', error);
              throw error;
            }
          }}
        />
      )}
    </div>
  );
};

const MaintenanceAdminView = ({ workOrders, setWorkOrders, fleet, setFleet, routines, setRoutines, variableHistory, setVariableHistory, currentUser }) => {
  const dialog = useDialog();
  const alert = useCallback(
    (message, options = {}) => {
      const title = options.title || 'Mensaje';
      const variant = options.variant || 'info';
      return dialog.alert({ title, message: String(message ?? ''), variant });
    },
    [dialog]
  );
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('ots'); // 'ots', 'routines', or 'history'
  const [closingOT, setClosingOT] = useState(null);

  const handleSaveClosedOT = async (closedOT) => {
    // 1. Try to save to API/LocalStorage
    try {
        await api.updateWorkOrder(closedOT.id, closedOT);
        console.log('✅ OT cerrada en BD:', closedOT.id);
    } catch (error) {
        console.error('Error cerrando OT en BD (Offline Mode):', error);
        // Fallback: update localStorage
        const currentOrders = JSON.parse(localStorage.getItem('work_orders') || '[]');
        const updatedOrders = currentOrders.map(ot => ot.id === closedOT.id ? closedOT : ot);
        localStorage.setItem('work_orders', JSON.stringify(updatedOrders));
        
        // Also update fleet in localStorage if needed
        if (closedOT.executionKm) {
             const currentFleet = JSON.parse(localStorage.getItem('fleet_data') || '[]');
             const newMileage = parseInt(closedOT.executionKm);
             const updatedFleet = currentFleet.map(v => {
                 if (v.code === closedOT.vehicleCode || v.plate === closedOT.plate) {
                     return { ...v, mileage: newMileage, lastMaintenance: newMileage };
                 }
                 return v;
             });
             localStorage.setItem('fleet_data', JSON.stringify(updatedFleet));
        }
    }

    // 2. Update Local State (UI)
    setWorkOrders(prev => prev.map(ot => 
      ot.id === closedOT.id ? closedOT : ot
    ));

    // 3. Reprogram Maintenance Cycle (Update Fleet Data)
    if (closedOT.executionKm) {
      const newMileage = parseInt(closedOT.executionKm);
      setFleet(prevFleet => prevFleet.map(vehicle => {
        if (vehicle.code === closedOT.vehicleCode || vehicle.plate === closedOT.plate) {
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
  };

  const handleAnularOT = async (otId) => {
    const ot = workOrders.find(o => o.id === otId);
    const label = ot?.otNumber ?? otId;
    const ok = await dialog.confirm({
      title: 'Confirmar anulación',
      message: `¿Está seguro de ANULAR la OT #${label}?`,
      variant: 'warning',
      confirmText: 'Anular',
      cancelText: 'Cancelar'
    });

    if (ok) {
        const updates = { status: 'ANULADA' };
        try {
            await api.updateWorkOrder(otId, updates);
        } catch (error) {
            console.error('Error anulando OT en BD (Offline Mode):', error);
            const currentOrders = JSON.parse(localStorage.getItem('work_orders') || '[]');
            const updatedOrders = currentOrders.map(ot => ot.id === otId ? { ...ot, ...updates } : ot);
            localStorage.setItem('work_orders', JSON.stringify(updatedOrders));
        }

        setWorkOrders(prev => prev.map(ot => 
            ot.id === otId ? { ...ot, status: 'ANULADA' } : ot
        ));
    }
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
        <button 
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-2 font-bold border-b-2 transition-colors ${activeTab === 'assets' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
        >
          Administración de Activos
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
        >
          Historial de Variables
        </button>
      </div>

      {activeTab === 'history' ? (
        <VariableHistory variableHistory={variableHistory} fleet={fleet} setVariableHistory={setVariableHistory} setFleet={setFleet} />
      ) : activeTab === 'assets' ? (
        <AssetManager fleet={fleet} setFleet={setFleet} routines={routines} />
      ) : activeTab === 'routines' ? (
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
                      <td className="p-4 font-mono font-bold text-blue-600">#{ot.otNumber ?? ot.id}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          ot.status === 'ABIERTA' ? 'bg-blue-100 text-blue-800' : 
                          ot.status === 'CERRADA' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
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
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={() => generatePDF(ot, alert)}
                            className="px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-xs font-medium border border-blue-200"
                            title="Lanzar OT (PDF)"
                          >
                            Lanzar OT
                          </button>
                          
                          {ot.status === 'ABIERTA' && (
                            <button 
                              onClick={() => setClosingOT(ot)}
                              className="px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 text-xs font-medium border border-green-200"
                            >
                              Cerrar OT
                            </button>
                          )}

                          <button 
                            onClick={() => alert('Funcionalidad de Editar OT en desarrollo', { title: 'En desarrollo', variant: 'info' })}
                            className="px-2 py-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 text-xs font-medium border border-amber-200"
                          >
                            Editar OT
                          </button>

                          {ot.status !== 'ANULADA' && (
                            <button 
                                onClick={() => handleAnularOT(ot.id)}
                                className="px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs font-medium border border-red-200"
                            >
                                Anular OT
                            </button>
                          )}
                        </div>
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
        <CloseOTModal 
          workOrder={closingOT}
          currentUser={currentUser}
          onClose={() => setClosingOT(null)}
          onSave={handleSaveClosedOT}
        />
      )}
    </div>
  );
};

const WorkOrders = ({ fleet }) => {
  const dialog = useDialog();
  const alert = useCallback(
    (message, options = {}) => {
      const title = options.title || 'Mensaje';
      const variant = options.variant || 'info';
      return dialog.alert({ title, message: String(message ?? ''), variant });
    },
    [dialog]
  );
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
    generatePDF(workOrder, alert);
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

const DataLoad = ({ fleet, setFleet, setVariableHistory, onLogout }) => {
  const dialog = useDialog();
  const alert = useCallback(
    (message, options = {}) => {
      const title = options.title || 'Mensaje';
      const variant = options.variant || 'info';
      return dialog.alert({ title, message: String(message ?? ''), variant });
    },
    [dialog]
  );
  const [loadMode, setLoadMode] = useState('masiva'); // 'individual' o 'masiva'
  const [pasteData, setPasteData] = useState('');
  const [preview, setPreview] = useState([]);
  const [hasErrors, setHasErrors] = useState(false);
  const [filterView, setFilterView] = useState('ALL'); // ALL, ERRORS, WARNINGS, VALID
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Estados para carga individual
  const [individualData, setIndividualData] = useState({
    plate: '',
    code: '',
    mileage: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5)
  });

  // Helper: Get last known variable from history
  const getLastKnownVariable = (plate, code, beforeDate) => {
    const history = JSON.parse(localStorage.getItem('variable_history') || '[]');
    const vehicleHistory = history
      .filter(h => (h.plate === plate || h.code === code))
      .map(h => {
        const [d, t] = (h.date || '').split(' ');
        const [day, month, year] = (d || '').split('/');
        const dateObj = new Date(`${year}-${month}-${day}T${t || '00:00:00'}`);
        return { ...h, dateObj };
      })
      .filter(h => h.dateObj < beforeDate)
      .sort((a, b) => b.dateObj - a.dateObj);
    
    return vehicleHistory[0] || null;
  };

  // Helper: Detect common typos (extra digit, transposed digits)
  const suggestCorrection = (value, expected, tolerance = 10000) => {
    // Check if adding/removing a leading digit makes it valid
    const valueStr = String(value);
    
    // Try removing first digit: 39112 -> 9112, 3112, etc.
    for (let i = 0; i < valueStr.length; i++) {
      const modified = parseInt(valueStr.slice(0, i) + valueStr.slice(i + 1));
      if (!isNaN(modified) && modified >= expected && modified <= expected + tolerance) {
        return modified;
      }
    }
    
    return null;
  };

  // Función para guardar carga individual
  const handleIndividualSave = () => {
    const { plate, code, mileage, date, time } = individualData;
    
    if (!plate && !code) {
      alert('❌ Debe ingresar al menos la placa o el código del vehículo');
      return;
    }
    
    if (!mileage || mileage <= 0) {
      alert('❌ Debe ingresar un kilometraje válido');
      return;
    }

    // Buscar el vehículo
    const vehicleIndex = fleet.findIndex(v => 
      (plate && v.plate.toUpperCase() === plate.toUpperCase()) ||
      (code && v.code.toUpperCase() === code.toUpperCase())
    );

    if (vehicleIndex === -1) {
      alert('❌ Vehículo no encontrado. Verifique la placa o código.');
      return;
    }

    const vehicle = fleet[vehicleIndex];
    const newMileage = parseInt(mileage);

    // Actualizar flota
    const updatedFleet = [...fleet];
    updatedFleet[vehicleIndex] = {
      ...vehicle,
      mileage: newMileage,
      lastVariableDate: `${date.split('-').reverse().join('/')} ${time}:00`
    };

    setFleet(updatedFleet);
    localStorage.setItem('fleet_data', JSON.stringify(updatedFleet));

    // Registrar en historial
    const newHistory = {
      id: Date.now(),
      plate: vehicle.plate,
      code: vehicle.code,
      date: `${date.split('-').reverse().join('/')} ${time}:00`,
      km: newMileage,
      mileage: newMileage,
      change: newMileage - (vehicle.mileage || 0),
      updatedBy: 'Manual',
      source: 'MANUAL_INDIVIDUAL'
    };

    setVariableHistory(prev => {
      const updated = [...prev, newHistory];
      localStorage.setItem('variable_history', JSON.stringify(updated));
      return updated;
    });

    alert(`✅ Variable actualizada correctamente\n${vehicle.plate} - ${vehicle.code}\nNuevo kilometraje: ${newMileage.toLocaleString()} KM`);
    
    // Limpiar formulario
    setIndividualData({
      plate: '',
      code: '',
      mileage: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5)
    });
  };

  const parseData = () => {
    const rows = pasteData.trim().split('\n');
    let errorFound = false;
    const groupedRecords = {};

    // 1. Parse ALL records and group by plate (no deduplication yet)
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

      if (!groupedRecords[plate]) {
        groupedRecords[plate] = [];
      }
      
      groupedRecords[plate].push({
        dateRaw,
        dateObj,
        km: newKm,
        plate,
        originalRow: row
      });
    });

    // 2. Analyze sequence for each vehicle
    const parsed = [];
    
    Object.entries(groupedRecords).forEach(([plate, records]) => {
      // Sort records by date
      const sortedRecords = records.sort((a, b) => a.dateObj - b.dateObj);
      
      // Find current vehicle
      const currentVehicle = fleet.find(v => v.plate === plate);
      const code = currentVehicle?.code || '---';
      const storedKm = currentVehicle?.mileage || 0;
      
      if (!currentVehicle) {
        // Vehicle not found - mark all records as error
        sortedRecords.forEach(record => {
          parsed.push({
            date: record.dateRaw,
            km: record.km,
            originalKm: record.km,
            code: '---',
            plate: record.plate,
            status: 'ERROR',
            message: 'Vehículo no encontrado',
            previousKm: null,
            daysSince: null,
            kmPerDay: null,
            suggestedKm: null,
            editable: true,
            batchSize: sortedRecords.length,
            shouldSkip: true
          });
        });
        errorFound = true;
        return;
      }
      
      // Get last known variable from storage
      const lastStored = getLastKnownVariable(plate, code, sortedRecords[0].dateObj);
      
      // Build complete sequence: [stored] -> [batch records]
      const fullSequence = [];
      if (lastStored) {
        fullSequence.push({
          dateObj: lastStored.dateObj,
          km: lastStored.km,
          isStored: true
        });
      } else if (storedKm > 0) {
        fullSequence.push({
          dateObj: new Date(0),
          km: storedKm,
          isStored: true
        });
      }
      fullSequence.push(...sortedRecords.map(r => ({ ...r, isStored: false })));
      
      // Analyze each record in the batch
      sortedRecords.forEach((record, idx) => {
        let status = 'VALID';
        let message = 'OK';
        let previousKm = null;
        let daysSince = null;
        let kmPerDay = null;
        let suggestedKm = null;
        let shouldSkip = false;
        
        // Find previous record in full sequence
        const recordIdx = fullSequence.findIndex(r => r === record);
        if (recordIdx > 0) {
          const prevRecord = fullSequence[recordIdx - 1];
          previousKm = prevRecord.km;
          daysSince = Math.floor((record.dateObj - prevRecord.dateObj) / (1000 * 60 * 60 * 24));
          
          if (daysSince > 0) {
            const kmDiff = record.km - previousKm;
            kmPerDay = Math.round(kmDiff / daysSince);
          }
        }
        
        // VALIDATION RULES
        if (record.km < storedKm) {
          status = 'ERROR';
          message = `Retrocede vs almacenado (${storedKm.toLocaleString()})`;
          errorFound = true;
          shouldSkip = true;
          
          suggestedKm = suggestCorrection(record.km, storedKm, 5000);
          if (suggestedKm) {
            message += ` - ¿${suggestedKm.toLocaleString()}?`;
            shouldSkip = false;
          }
        } else if (previousKm && record.km < previousKm) {
          status = 'ERROR';
          message = `Retrocede en el lote (${previousKm.toLocaleString()})`;
          errorFound = true;
          shouldSkip = true;
        } else if (kmPerDay !== null && kmPerDay > 500) {
          status = 'ERROR';
          message = `${kmPerDay} km/día es anormal (${daysSince}d) - REVISAR`;
          errorFound = true;
          
          suggestedKm = suggestCorrection(record.km, previousKm, daysSince * 500);
          if (suggestedKm) {
            const newKmPerDay = Math.round((suggestedKm - previousKm) / daysSince);
            message += ` | Sugerencia: ${suggestedKm.toLocaleString()} (${newKmPerDay} km/d)`;
          } else {
            message += ' | Considera DESCARTAR este registro';
            shouldSkip = true;
          }
        } else if (kmPerDay !== null && kmPerDay > 300) {
          status = 'WARNING';
          message = `${kmPerDay} km/día es alto - Verificar`;
        } else if (kmPerDay !== null && kmPerDay === 0 && daysSince > 0) {
          status = 'WARNING';
          message = `Sin cambio de KM en ${daysSince} días`;
        }
        
        parsed.push({
          date: record.dateRaw,
          km: record.km,
          originalKm: record.km,
          code: code,
          plate: record.plate,
          status,
          message,
          previousKm,
          daysSince,
          kmPerDay,
          suggestedKm,
          editable: true,
          batchSize: sortedRecords.length,
          batchIndex: idx + 1,
          shouldSkip
        });
      });
    });

    setPreview(parsed);
    setHasErrors(errorFound);
  };

  const applyChanges = async () => {
    // Always filter out records marked to skip or with ERROR status
    let recordsToProcess = preview.filter(p => p.status !== 'ERROR' && !p.shouldSkip);
    
    if (recordsToProcess.length === 0) {
      alert("❌ No hay registros válidos para procesar.");
      return;
    }

    // Check if we're excluding any records and ask for confirmation
    const totalRecords = preview.length;
    const excludedRecords = totalRecords - recordsToProcess.length;
    
    if (excludedRecords > 0) {
      const ok = await dialog.confirm({
        title: 'Confirmar carga',
        message:
          `📊 Resumen:\n` +
          `• Total registros: ${totalRecords}\n` +
          `• A cargar: ${recordsToProcess.length}\n` +
          `• A omitir: ${excludedRecords}\n\n` +
          `¿Desea continuar?`,
        variant: 'warning',
        confirmText: 'Continuar',
        cancelText: 'Cancelar'
      });
      if (!ok) return;
    }

    setIsProcessing(true);
    
    // Save to API
    const saveToApi = async () => {
      try {
        // Save variable history to API (which also updates vehicle mileage and intelligent maintenance data)
        const response = await api.saveVariables(recordsToProcess.map(p => ({
          plate: p.plate,
          code: p.code,
          km: p.km,
          date: p.date
        })));
        
        // Intelligent sync: Update all vehicles with latest closed work orders
        await api.syncMaintenanceData();
        
        // Reload fleet data to get updated mileages and maintenance info
        const updatedFleet = await api.getVehicles();
        setFleet(updatedFleet);
        
        // Reload variable history
        const updatedHistory = await api.getVariables();
        setVariableHistory(updatedHistory);
        
        const successMsg = response.failed > 0 
          ? `✅ ${response.count} registro(s) guardado(s), ${response.failed} fallaron. Datos de mantenimiento sincronizados.`
          : `✅ ${response.count} registro(s) guardado(s) y datos de mantenimiento sincronizados.`;
        
        alert(successMsg);
        
      } catch (error) {
        console.error('Error saving to API:', error);

        if (error.message.includes('401')) {
            alert('⚠️ Su sesión ha expirado o no tiene permisos. Por favor, inicie sesión nuevamente.');
            if (onLogout) onLogout();
            return;
        }

        const errorDetails = `
Error guardando en servidor:
${error.message}

URL del API: ${api.baseURL}
Registros a guardar: ${recordsToProcess.length}

Posibles causas:
- El servidor backend no está activo en Render
- Las variables de entorno no están configuradas
- Error en la base de datos PostgreSQL

Guardando localmente como respaldo...
        `;
        alert(`⚠️ ${errorDetails.trim()}`);
        
        // Fallback: Update local state
        setFleet(prev => {
          const newFleet = [...prev];
          recordsToProcess.forEach(update => {
            const index = newFleet.findIndex(v => v.code === update.code || v.plate === update.plate);
            if (index !== -1) {
              newFleet[index] = { ...newFleet[index], mileage: update.km };
            }
          });
          localStorage.setItem('fleet_data', JSON.stringify(newFleet));
          return newFleet;
        });
        
        setVariableHistory(prev => {
          const updated = [...prev, ...recordsToProcess];
          localStorage.setItem('variable_history', JSON.stringify(updated));
          return updated;
        });
      } finally {
        setPasteData('');
        setPreview([]);
        setHasErrors(false);
        setFilterView('ALL');
        setIsProcessing(false);
      }
    };
    
    saveToApi();
  };

  // Auto-parse on paste
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    setPasteData(text);
    
    // Parse immediately with the pasted text (not waiting for state update)
    parseDataFromText(text);
  };

  // Parse from explicit text input (for paste handler)
  const parseDataFromText = (textInput) => {
    const rows = textInput.trim().split('\n');
    let errorFound = false;
    const groupedRecords = {};

    // Parse ALL records and group by plate (no deduplication yet)
    rows.forEach(row => {
      const cols = row.split(/\t/);
      if (cols.length < 3) return;

      const dateRaw = cols[0]?.trim();
      const kmRaw = cols[1]?.trim();
      const plate = cols[2]?.trim();
      
      const kmClean = kmRaw?.split(',')[0].replace(/\./g, '');
      const newKm = parseInt(kmClean) || 0;

      const [d, t] = dateRaw.split(' ');
      const [day, month, year] = d.split('/');
      const isoDate = `${year}-${month}-${day}T${t}`;
      const dateObj = new Date(isoDate);

      if (!groupedRecords[plate]) {
        groupedRecords[plate] = [];
      }
      
      groupedRecords[plate].push({
        dateRaw,
        dateObj,
        km: newKm,
        plate,
        originalRow: row
      });
    });

    // Analyze sequence for each vehicle
    const parsed = [];
    
    Object.entries(groupedRecords).forEach(([plate, records]) => {
      const sortedRecords = records.sort((a, b) => a.dateObj - b.dateObj);
      const currentVehicle = fleet.find(v => v.plate === plate);
      const code = currentVehicle?.code || '---';
      const storedKm = currentVehicle?.mileage || 0;
      
      if (!currentVehicle) {
        sortedRecords.forEach(record => {
          parsed.push({
            date: record.dateRaw,
            km: record.km,
            originalKm: record.km,
            code: '---',
            plate: record.plate,
            status: 'ERROR',
            message: 'Vehículo no encontrado',
            previousKm: null,
            daysSince: null,
            kmPerDay: null,
            suggestedKm: null,
            editable: true,
            batchSize: sortedRecords.length,
            shouldSkip: true
          });
        });
        errorFound = true;
        return;
      }
      
      const lastStored = getLastKnownVariable(plate, code, sortedRecords[0].dateObj);
      const fullSequence = [];
      if (lastStored) {
        fullSequence.push({
          dateObj: lastStored.dateObj,
          km: lastStored.km,
          isStored: true
        });
      } else if (storedKm > 0) {
        fullSequence.push({
          dateObj: new Date(0),
          km: storedKm,
          isStored: true
        });
      }
      fullSequence.push(...sortedRecords.map(r => ({ ...r, isStored: false })));
      
      sortedRecords.forEach((record, idx) => {
        let status = 'VALID';
        let message = 'OK';
        let previousKm = null;
        let daysSince = null;
        let kmPerDay = null;
        let suggestedKm = null;
        let shouldSkip = false;
        
        const recordIdx = fullSequence.findIndex(r => r === record);
        if (recordIdx > 0) {
          const prevRecord = fullSequence[recordIdx - 1];
          previousKm = prevRecord.km;
          daysSince = Math.floor((record.dateObj - prevRecord.dateObj) / (1000 * 60 * 60 * 24));
          
          if (daysSince > 0) {
            const kmDiff = record.km - previousKm;
            kmPerDay = Math.round(kmDiff / daysSince);
          }
        }
        
        if (record.km < storedKm) {
          status = 'ERROR';
          message = `Retrocede vs almacenado (${storedKm.toLocaleString()})`;
          errorFound = true;
          shouldSkip = true;
          
          suggestedKm = suggestCorrection(record.km, storedKm, 5000);
          if (suggestedKm) {
            message += ` - ¿${suggestedKm.toLocaleString()}?`;
            shouldSkip = false;
          }
        } else if (previousKm && record.km < previousKm) {
          status = 'ERROR';
          message = `Retrocede en el lote (${previousKm.toLocaleString()})`;
          errorFound = true;
          shouldSkip = true;
        } else if (kmPerDay !== null && kmPerDay > 500) {
          status = 'ERROR';
          message = `${kmPerDay} km/día es anormal (${daysSince}d) - REVISAR`;
          errorFound = true;
          
          suggestedKm = suggestCorrection(record.km, previousKm, daysSince * 500);
          if (suggestedKm) {
            const newKmPerDay = Math.round((suggestedKm - previousKm) / daysSince);
            message += ` | Sugerencia: ${suggestedKm.toLocaleString()} (${newKmPerDay} km/d)`;
          } else {
            message += ' | Considera DESCARTAR este registro';
            shouldSkip = true;
          }
        } else if (kmPerDay !== null && kmPerDay > 300) {
          status = 'WARNING';
          message = `${kmPerDay} km/día es alto - Verificar`;
        } else if (kmPerDay !== null && kmPerDay === 0 && daysSince > 0) {
          status = 'WARNING';
          message = `Sin cambio de KM en ${daysSince} días`;
        }
        
        parsed.push({
          date: record.dateRaw,
          km: record.km,
          originalKm: record.km,
          code: code,
          plate: record.plate,
          status,
          message,
          previousKm,
          daysSince,
          kmPerDay,
          suggestedKm,
          editable: true,
          batchSize: sortedRecords.length,
          batchIndex: idx + 1,
          shouldSkip
        });
      });
    });

    setPreview(parsed);
    setHasErrors(errorFound);
  };

  // Stats calculation
  const stats = {
    total: preview.length,
    valid: preview.filter(p => p.status === 'VALID' && !p.shouldSkip).length,
    warnings: preview.filter(p => p.status === 'WARNING').length,
    errors: preview.filter(p => p.status === 'ERROR' || p.shouldSkip).length
  };

  // Filtered preview
  const filteredPreview = preview.filter(row => {
    if (filterView === 'ERRORS') return row.status === 'ERROR' || row.shouldSkip;
    if (filterView === 'WARNINGS') return row.status === 'WARNING';
    if (filterView === 'VALID') return row.status === 'VALID' && !row.shouldSkip;
    return true; // ALL
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Upload className="text-blue-600" /> Carga de Variables
        </h2>
        {preview.length > 0 && (
          <div className="flex gap-2 items-center text-sm">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-semibold">{stats.valid} OK</span>
            {stats.warnings > 0 && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-semibold">{stats.warnings} Alertas</span>}
            {stats.errors > 0 && <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">{stats.errors} Errores</span>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        {/* Pestañas Individual / Masiva */}
        <div className="flex gap-2 p-4 border-b bg-slate-50">
          <button
            onClick={() => setLoadMode('individual')}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              loadMode === 'individual'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Individual
          </button>
          <button
            onClick={() => setLoadMode('masiva')}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              loadMode === 'masiva'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Masiva
          </button>
        </div>

        {/* Formulario Individual */}
        {loadMode === 'individual' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Identificación del Vehículo - Verde */}
              <div className="col-span-2 bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="text-sm font-bold text-green-800 mb-3">📋 Identificación</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Placa</label>
                    <input
                      type="text"
                      value={individualData.plate}
                      onChange={e => setIndividualData({...individualData, plate: e.target.value.toUpperCase()})}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 uppercase"
                      placeholder="Ej: NTW668"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Código</label>
                    <input
                      type="text"
                      value={individualData.code}
                      onChange={e => setIndividualData({...individualData, code: e.target.value.toUpperCase()})}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 uppercase"
                      placeholder="Ej: E16"
                    />
                  </div>
                </div>
              </div>

              {/* Variable - Azul */}
              <div className="col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-sm font-bold text-blue-800 mb-3">📊 Variable Actual</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Kilometraje</label>
                    <input
                      type="number"
                      value={individualData.mileage}
                      onChange={e => setIndividualData({...individualData, mileage: e.target.value})}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="35000"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Fecha</label>
                    <input
                      type="date"
                      value={individualData.date}
                      onChange={e => setIndividualData({...individualData, date: e.target.value})}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Hora</label>
                    <input
                      type="time"
                      value={individualData.time}
                      onChange={e => setIndividualData({...individualData, time: e.target.value})}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIndividualData({
                  plate: '',
                  code: '',
                  mileage: '',
                  date: new Date().toISOString().split('T')[0],
                  time: new Date().toTimeString().split(' ')[0].substring(0, 5)
                })}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold"
              >
                Limpiar
              </button>
              <button
                onClick={handleIndividualSave}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold shadow"
              >
                💾 Guardar Variable
              </button>
            </div>
          </div>
        )}

        {/* Carga Masiva */}
        {loadMode === 'masiva' && (
          <>
            <div className="p-4 border-b">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2">
                    📋 Pegar desde Excel (Ctrl+V) - Auto-valida instantáneamente
                  </label>
                  <textarea 
                    className="w-full h-24 p-3 border-2 border-dashed border-blue-300 rounded-lg font-mono text-xs bg-blue-50 focus:border-blue-500 focus:bg-white transition-colors"
                    placeholder="Copiar columnas de Excel y pegar aquí (Fecha | KM | Placa)&#10;&#10;Ejemplo:&#10;12/12/2025 08:20:25    33.394,000    NTW668&#10;12/12/2025 08:13:40    28.577,000    NNL597"
                    value={pasteData}
                    onChange={e => setPasteData(e.target.value)}
                    onPaste={handlePaste}
                  />
                </div>
                {pasteData && (
                  <button 
                    onClick={() => { setPasteData(''); setPreview([]); setHasErrors(false); }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-sm font-semibold"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {preview.length > 0 && (
          <>
            <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
              <div className="flex gap-2">
                <button 
                  onClick={() => setFilterView('ALL')}
                  className={`px-3 py-1 rounded text-sm font-semibold ${filterView === 'ALL' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
                >
                  Todos ({stats.total})
                </button>
                <button 
                  onClick={() => setFilterView('VALID')}
                  className={`px-3 py-1 rounded text-sm font-semibold ${filterView === 'VALID' ? 'bg-green-600 text-white' : 'bg-white text-green-600 hover:bg-green-50'}`}
                >
                  Válidos ({stats.valid})
                </button>
                {stats.warnings > 0 && (
                  <button 
                    onClick={() => setFilterView('WARNINGS')}
                    className={`px-3 py-1 rounded text-sm font-semibold ${filterView === 'WARNINGS' ? 'bg-yellow-600 text-white' : 'bg-white text-yellow-600 hover:bg-yellow-50'}`}
                  >
                    Alertas ({stats.warnings})
                  </button>
                )}
                {stats.errors > 0 && (
                  <button 
                    onClick={() => setFilterView('ERRORS')}
                    className={`px-3 py-1 rounded text-sm font-semibold ${filterView === 'ERRORS' ? 'bg-red-600 text-white' : 'bg-white text-red-600 hover:bg-red-50'}`}
                  >
                    Errores ({stats.errors})
                  </button>
                )}
              </div>
              <button 
                onClick={applyChanges}
                disabled={stats.valid === 0 || isProcessing}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? '⏳ Procesando...' : `✓ Cargar ${stats.valid} Registro${stats.valid !== 1 ? 's' : ''}`}
              </button>
            </div>

            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
              <h3 className="font-semibold mb-4">2. Validación Inteligente</h3>
              <table className="w-full text-sm">
                <thead className="bg-slate-700 text-white sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Estado</th>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Vehículo</th>
                    <th className="p-2 text-right">KM Ant.</th>
                    <th className="p-2 text-right">KM Nuevo</th>
                    <th className="p-2 text-center">Días</th>
                    <th className="p-2 text-center">km/d</th>
                    <th className="p-2 text-left">Análisis</th>
                    <th className="p-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreview.map((row, i) => {
                    const actualIndex = preview.indexOf(row);
                    const bgColor = row.shouldSkip ? 'bg-red-100 line-through' : row.status === 'ERROR' ? 'bg-red-50' : row.status === 'WARNING' ? 'bg-yellow-50' : '';
                    return (
                      <tr key={actualIndex} className={`border-b hover:bg-slate-100 ${bgColor}`}>
                        <td className="p-2">
                          {row.shouldSkip ? (
                            <span className="text-red-700 text-xs font-bold">⊗ Omitir</span>
                          ) : row.status === 'ERROR' ? (
                            <span className="text-red-600 text-xs font-bold">✕ Error</span>
                          ) : row.status === 'WARNING' ? (
                            <span className="text-yellow-600 text-xs font-bold">⚠ Alerta</span>
                          ) : (
                            <span className="text-green-600 text-xs font-bold">✓ OK</span>
                          )}
                        </td>
                        <td className="p-2 text-xs text-slate-700">
                          {row.date.split(' ')[0]}
                          {row.batchSize > 1 && (
                            <span className="ml-1 text-[10px] text-blue-600 font-semibold">
                              [{row.batchIndex}/{row.batchSize}]
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="font-semibold text-sm">{row.plate}</div>
                          <div className="text-[10px] text-slate-500">{row.code}</div>
                        </td>
                        <td className="p-2 text-right text-slate-600 font-mono text-xs">
                          {row.previousKm ? row.previousKm.toLocaleString() : '—'}
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="text"
                            value={row.km.toLocaleString()}
                            onChange={(e) => {
                              const newKm = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                              setPreview(prev => {
                                const updated = [...prev];
                                updated[actualIndex] = { ...updated[actualIndex], km: newKm };
                                return updated;
                              });
                            }}
                            className="w-20 px-2 py-1 border rounded font-mono text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-center text-xs text-slate-600">
                          {row.daysSince !== null ? row.daysSince : '—'}
                        </td>
                        <td className="p-2 text-center font-mono text-xs font-bold">
                          {row.kmPerDay !== null ? (
                            <span className={`px-1 rounded ${row.kmPerDay > 500 ? 'bg-red-200 text-red-800' : row.kmPerDay > 300 ? 'bg-yellow-200 text-yellow-800' : 'text-slate-700'}`}>
                              {row.kmPerDay}
                            </span>
                          ) : '—'}
                        </td>
                        <td className={`p-2 text-xs ${row.status === 'ERROR' ? 'text-red-700 font-semibold' : row.status === 'WARNING' ? 'text-yellow-700' : 'text-slate-600'}`}>
                          {row.message}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 justify-center">
                            {row.suggestedKm && !row.shouldSkip && (
                              <button
                                onClick={() => {
                                  setPreview(prev => {
                                    const updated = [...prev];
                                    updated[actualIndex] = { ...updated[actualIndex], km: row.suggestedKm, shouldSkip: false };
                                    return updated;
                                  });
                                }}
                                className="px-2 py-1 bg-blue-500 text-white text-[10px] rounded hover:bg-blue-600 font-semibold"
                                title={`Corregir a ${row.suggestedKm.toLocaleString()}`}
                              >
                                ✓ {row.suggestedKm.toLocaleString()}
                              </button>
                            )}
                            {row.shouldSkip ? (
                              <button
                                onClick={() => {
                                  setPreview(prev => {
                                    const updated = [...prev];
                                    updated[actualIndex] = { ...updated[actualIndex], shouldSkip: false };
                                    return updated;
                                  });
                                }}
                                className="px-2 py-1 bg-green-500 text-white text-[10px] rounded hover:bg-green-600 font-semibold"
                              >
                                ↺ Incluir
                              </button>
                            ) : row.status === 'ERROR' && (
                              <button
                                onClick={() => {
                                  setPreview(prev => {
                                    const updated = [...prev];
                                    updated[actualIndex] = { ...updated[actualIndex], shouldSkip: true };
                                    return updated;
                                  });
                                }}
                                className="px-2 py-1 bg-slate-400 text-white text-[10px] rounded hover:bg-slate-500 font-semibold"
                              >
                                ⊗ Omitir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {preview.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <Upload size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold">Esperando datos...</p>
            <p className="text-sm mt-2">Copia las columnas de Excel y pégalas arriba</p>
          </div>
        )}
          </>
        )}
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
  const dialog = useDialog();

  // Local helper to replace browser alert() with centered in-app dialog
  const alert = useCallback(
    (message, options = {}) => {
      const title = options.title || 'Mensaje';
      const variant = options.variant || 'info';
      return dialog.alert({ title, message: String(message ?? ''), variant });
    },
    [dialog]
  );

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [fleet, setFleet] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [variableHistory, setVariableHistory] = useState([]);
  const [routines, setRoutines] = useState(MAINTENANCE_ROUTINES);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('authenticated_user');
    const savedToken = localStorage.getItem('auth_token');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setCurrentUser(userData);
      setIsAuthenticated(Boolean(savedToken));
    }
  }, []);

  const handleLogin = (user) => {
    // user: { username, name, role, token }
    const sessionUser = {
      username: user.username,
      name: user.name,
      role: user.role,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem('authenticated_user', JSON.stringify(sessionUser));
    if (user.token) localStorage.setItem('auth_token', user.token);
    setCurrentUser(sessionUser);
    setIsAuthenticated(Boolean(user.token));
  };

  const handleLogout = () => {
    localStorage.removeItem('authenticated_user');
    localStorage.removeItem('auth_token');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setFleet([]);
    setWorkOrders([]);
    setVariableHistory([]);
  };

  // Load initial data from API (only after authentication)
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        setApiError(null);

        const safeJsonParse = (text, fallback) => {
          try {
            return JSON.parse(text);
          } catch {
            return fallback;
          }
        };

        const asArray = (value) => {
          if (Array.isArray(value)) return value;
          if (Array.isArray(value?.vehicles)) return value.vehicles;
          if (Array.isArray(value?.data)) return value.data;
          return [];
        };

        const toNumberOr = (value, fallback = 0) => {
          const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
          return Number.isFinite(n) ? n : fallback;
        };

        const normalizeVehicle = (vehicle, index) => {
          const mileage = toNumberOr(vehicle?.mileage, null);
          const currentKm = toNumberOr(vehicle?.currentKm ?? vehicle?.currentMileage ?? vehicle?.km, null);
          const lastMaintenance = toNumberOr(vehicle?.lastMaintenance, null);
          const lastMaintenanceKm = toNumberOr(vehicle?.lastMaintenanceKm ?? vehicle?.lastMaintenanceMileage, null);
          const maintenanceCycle = toNumberOr(vehicle?.maintenanceCycle, null);
          const frequency = toNumberOr(vehicle?.frequency, null);

          const normalizedMileage = mileage ?? currentKm ?? 0;
          const normalizedLastMaintenance = lastMaintenance ?? lastMaintenanceKm ?? 0;
          const normalizedCycle = maintenanceCycle ?? frequency ?? 5000;

          const idNum = toNumberOr(vehicle?.id, null);

          return {
            ...vehicle,
            id: idNum ?? (index + 1),
            code: vehicle?.code ?? vehicle?.codigo ?? '',
            plate: vehicle?.plate ?? vehicle?.placa ?? '',
            model: vehicle?.model ?? vehicle?.modeloLinea ?? vehicle?.description ?? vehicle?.descripcion ?? '',
            brand: vehicle?.brand ?? vehicle?.marca ?? '',
            status: vehicle?.status ?? vehicle?.estadoActual ?? 'OPERATIVO',
            mileage: Math.round(toNumberOr(normalizedMileage, 0)),
            lastMaintenance: Math.round(toNumberOr(normalizedLastMaintenance, 0)),
            maintenanceCycle: Math.round(toNumberOr(normalizedCycle, 5000)),
            lastMaintenanceDate: vehicle?.lastMaintenanceDate ?? vehicle?.lastMaintenanceDate ?? null,
            lastVariableDate: vehicle?.lastVariableDate ?? vehicle?.variableDate ?? vehicle?.lastUpdate ?? ''
          };
        };
        
        // Try API first (source of truth)
        let vehicles = [];
        let orders = [];
        let history = [];
        let apiFailed = false;
        
        try {
          vehicles = await api.getVehicles();
          orders = await api.getWorkOrders();
          history = await api.getVariables();
        } catch (apiError) {
          apiFailed = true;
          console.warn('API not available, using localStorage (offline fallback):', apiError.message);
        }

        vehicles = asArray(vehicles);
        orders = asArray(orders);
        history = asArray(history);
        
        const savedFleet = localStorage.getItem('fleet_data');
        const savedOrders = localStorage.getItem('work_orders');
        const savedHistory = localStorage.getItem('variable_history');

        // Only use localStorage when the API is unavailable (offline mode).
        // If the API is reachable but returns empty, we should NOT fall back to cached/local data,
        // because that would risk showing stale/incorrect information.
        if (apiFailed) {
          if (vehicles.length === 0 && savedFleet) {
            console.log('📦 Loading fleet from localStorage (offline)');
            vehicles = asArray(safeJsonParse(savedFleet, []));
          }
          if (orders.length === 0 && savedOrders) {
            console.log('📦 Loading orders from localStorage (offline)');
            orders = asArray(safeJsonParse(savedOrders, []));
          }
          if (history.length === 0 && savedHistory) {
            console.log('📦 Loading history from localStorage (offline)');
            history = asArray(safeJsonParse(savedHistory, []));
          }
        }

        // If no vehicles are available and API did not fail, it likely means the DB is empty.
        // For production, this is a critical misconfiguration: do not silently inject local sample data.
        const allowLocalFallback = import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL_FALLBACK === 'true';
        if (!apiFailed && vehicles.length === 0) {
          if (allowLocalFallback) {
            console.warn('⚠️ API devolvió 0 vehículos. Usando INITIAL_FLEET (solo dev/flag).');
            vehicles = INITIAL_FLEET;
            
            // Generar OT de ejemplo si no hay OTs
            if (orders.length === 0) {
              const exampleOT = {
                id: 1001,
                vehicleCode: vehicles[0]?.code || 'V-001',
                plate: vehicles[0]?.plate || 'ABC-123',
                vehicleModel: vehicles[0]?.model || 'Toyota Hilux',
                routineName: 'Mantenimiento 5,000 KM',
                workshop: 'TALLER EL HATO',
                status: 'ABIERTA',
                creationDate: new Date().toISOString().split('T')[0],
                mileage: vehicles[0]?.mileage || 5000,
                items: [
                  { description: 'Cambio de Aceite Motor', type: 'Preventivo' },
                  { description: 'Revisión de Frenos', type: 'Inspección' }
                ],
                supplies: [
                  { reference: 'FIL-001', name: 'Filtro de Aceite', quantity: 1 }
                ]
              };
              orders = [exampleOT];
              console.log('📝 Generada OT de ejemplo:', exampleOT.id);
            }
          } else {
            setApiError('La base de datos no tiene vehículos cargados. Contacte al administrador para ejecutar el seed.');
          }
        }

        // In offline fallback mode, persist only what the user already had locally.
        // We never auto-seed production from the browser.

        // Normalize fleet shape to avoid runtime crashes in PlanningView
        vehicles = asArray(vehicles).map(normalizeVehicle);
        
        // Set state
        setFleet(vehicles);
        setWorkOrders(orders);
        setVariableHistory(history);
        
      } catch (error) {
        console.error('Error loading data:', error);
        setApiError(error.message);
        
        // Fallback to localStorage if everything fails
        const savedFleet = localStorage.getItem('fleet_data');
        const savedOrders = localStorage.getItem('work_orders');
        const savedHistory = localStorage.getItem('variable_history');
        
        const fleetFallback = savedFleet ? safeJsonParse(savedFleet, INITIAL_FLEET) : INITIAL_FLEET;
        const ordersFallback = savedOrders ? safeJsonParse(savedOrders, []) : [];
        const historyFallback = savedHistory ? safeJsonParse(savedHistory, []) : [];

        console.log('� Cargando datos de respaldo - Flota:', fleetFallback?.length || 0, 'vehículos');
        
        // Auto-save INITIAL_FLEET to localStorage if not present
        if (!savedFleet && fleetFallback === INITIAL_FLEET) {
          localStorage.setItem('fleet_data', JSON.stringify(INITIAL_FLEET));
          console.log('💾 Datos iniciales guardados para próxima sesión');
        }

        let finalOrdersFallback = asArray(ordersFallback);
        // Generar OT de ejemplo si no hay OTs en fallback
        if (finalOrdersFallback.length === 0 && fleetFallback.length > 0) {
            const exampleOT = {
              id: 1001,
              vehicleCode: fleetFallback[0]?.code || 'V-001',
              plate: fleetFallback[0]?.plate || 'ABC-123',
              vehicleModel: fleetFallback[0]?.model || 'Toyota Hilux',
              routineName: 'Mantenimiento 5,000 KM',
              workshop: 'TALLER EL HATO',
              status: 'ABIERTA',
              creationDate: new Date().toISOString().split('T')[0],
              mileage: fleetFallback[0]?.mileage || 5000,
              items: [
                { description: 'Cambio de Aceite Motor', type: 'Preventivo' },
                { description: 'Revisión de Frenos', type: 'Inspección' }
              ],
              supplies: [
                { reference: 'FIL-001', name: 'Filtro de Aceite', quantity: 1 }
              ]
            };
            finalOrdersFallback = [exampleOT];
            console.log('📝 Generada OT de ejemplo (Offline Mode):', exampleOT.id);
        }

        setFleet(asArray(fleetFallback).map(normalizeVehicle));
        setWorkOrders(finalOrdersFallback);
        setVariableHistory(asArray(historyFallback));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [isAuthenticated]);

  const handleCreateOT = async (newOT) => {
    try {
      // Guardar en API primero
      const savedOTRaw = await api.createWorkOrder(newOT);
      const safeParse = (value, fallback) => {
        if (value == null) return fallback;
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : fallback;
          } catch {
            return fallback;
          }
        }
        return fallback;
      };

      const savedOT = {
        ...savedOTRaw,
        items: safeParse(savedOTRaw?.items, newOT?.items || []),
        supplies: safeParse(savedOTRaw?.supplies, newOT?.supplies || [])
      };

      setWorkOrders(prev => [savedOT, ...prev]);
      console.log('✅ OT guardada en BD:', savedOT.id);
      return savedOT;
    } catch (error) {
      console.error('Error guardando OT en BD:', error);
      // Fallback: guardar solo en estado local
      const offlineOT = {
        ...newOT,
        // Ensure we always have a stable identifier in offline mode
        id: newOT?.id || `offline-${Date.now()}`
      };
      setWorkOrders(prev => [offlineOT, ...prev]);
      localStorage.setItem('work_orders', JSON.stringify([offlineOT, ...workOrders]));
      return offlineOT;
    }
  };

  const renderView = () => {
    switch(currentView) {
      case 'dashboard': return <Dashboard fleet={fleet} workOrders={workOrders} variableHistory={variableHistory} />;
      case 'planning': return <PlanningView fleet={fleet} setFleet={setFleet} onCreateOT={handleCreateOT} workOrders={workOrders} setWorkOrders={setWorkOrders} variableHistory={variableHistory} setVariableHistory={setVariableHistory} routines={routines} currentUser={currentUser} />;
      case 'maintenance-admin': return <MaintenanceAdminView workOrders={workOrders} setWorkOrders={setWorkOrders} fleet={fleet} setFleet={setFleet} routines={routines} setRoutines={setRoutines} variableHistory={variableHistory} setVariableHistory={setVariableHistory} currentUser={currentUser} />;
      case 'work-orders': return <WorkOrders fleet={fleet} />;
      case 'drivers': return <DriverAssignment fleet={fleet} setFleet={setFleet} />;
      case 'dataload': return <DataLoad fleet={fleet} setFleet={setFleet} setVariableHistory={setVariableHistory} onLogout={handleLogout} />;
      case 'gps': return (
        <div className="p-8 flex flex-col items-center justify-center h-full">
          <MapPin size={64} className="text-blue-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Ubicación GPS</h2>
          <p className="text-slate-500 text-center">Módulo en desarrollo - Próximamente</p>
        </div>
      );
      case 'tires': return (
        <div className="p-8 flex flex-col items-center justify-center h-full">
          <CircleDot size={64} className="text-blue-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Control de Llantas</h2>
          <p className="text-slate-500 text-center">Módulo en desarrollo - Próximamente</p>
        </div>
      );
      case 'fuel': return (
        <div className="p-8 flex flex-col items-center justify-center h-full">
          <Fuel size={64} className="text-blue-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Rendimiento de Combustible</h2>
          <p className="text-slate-500 text-center">Módulo en desarrollo - Próximamente</p>
        </div>
      );
      default: return <Dashboard fleet={fleet} workOrders={workOrders} variableHistory={variableHistory} />;
    }
  };

  const getTitle = () => {
    switch(currentView) {
      case 'dashboard': return 'Dashboard - Métricas y Análisis';
      case 'planning': return 'Planeación de Mantenimiento (Camionetas)';
      case 'maintenance-admin': return 'Administración de Mantenimiento';
      case 'work-orders': return 'Generador de Órdenes de Trabajo';
      case 'drivers': return 'Asignación de Conductores';
      case 'dataload': return 'Carga Masiva de Variables';
      case 'gps': return 'Ubicación GPS';
      case 'tires': return 'Control de Llantas';
      case 'fuel': return 'Rendimiento de Combustible';
      default: return 'Dashboard - Métricas y Análisis';
    }
  };

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Show loading screen while data is being loaded
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Cargando Sistema</h2>
          <p className="text-slate-500 text-sm">Inicializando datos de flota...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300 flex flex-col border-r border-gray-200`}>
        {/* Logo Section */}
        <div className={`flex items-center justify-center border-b border-gray-200 relative ${isSidebarOpen ? 'p-3 h-16' : 'p-2 h-20'}`}>
          {isSidebarOpen ? (
            <>
              <img src="/logo-sidebar.png" alt="Fleet Pro Logo" className="h-11 w-auto flex-shrink-0" />
              <button onClick={() => setIsSidebarOpen(false)} className="absolute right-3 p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                <X size={18} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="w-full h-full flex items-center justify-center"
            >
              <img src="/Minimal-logo.png" alt="Logo" className="w-24 h-24 object-contain" />
            </button>
          )}
        </div>

        <nav className="flex-1 py-5 overflow-y-auto">
          <ul className="space-y-2">
            <li>
              <button 
                onClick={() => setCurrentView('dashboard')}
                className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center'} py-3 hover:bg-blue-50 transition-colors ${currentView === 'dashboard' ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : 'text-gray-700'}`}
              >
                <LayoutDashboard size={22} className={currentView === 'dashboard' ? 'text-blue-600' : 'text-gray-500'} />
                {isSidebarOpen && <span className="font-medium text-sm">Dashboard</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('planning')}
                className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center'} py-3 hover:bg-blue-50 transition-colors ${currentView === 'planning' ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : 'text-gray-700'}`}
              >
                <Calendar size={22} className={currentView === 'planning' ? 'text-blue-600' : 'text-gray-500'} />
                {isSidebarOpen && <span className="font-medium text-sm">Planeación</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('maintenance-admin')}
                className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center'} py-3 hover:bg-blue-50 transition-colors ${currentView === 'maintenance-admin' ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : 'text-gray-700'}`}
              >
                <Wrench size={22} className={currentView === 'maintenance-admin' ? 'text-blue-600' : 'text-gray-500'} />
                {isSidebarOpen && <span className="font-medium text-sm">Admin. Mantenimiento</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('work-orders')}
                className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center'} py-3 hover:bg-blue-50 transition-colors ${currentView === 'work-orders' ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : 'text-gray-700'}`}
              >
                <ClipboardList size={22} className={currentView === 'work-orders' ? 'text-blue-600' : 'text-gray-500'} />
                {isSidebarOpen && <span className="font-medium text-sm">Generar OTs</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('drivers')}
                className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center'} py-3 hover:bg-blue-50 transition-colors ${currentView === 'drivers' ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : 'text-gray-700'}`}
              >
                <Car size={22} className={currentView === 'drivers' ? 'text-blue-600' : 'text-gray-500'} />
                {isSidebarOpen && <span className="font-medium text-sm">Conductores</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('dataload')}
                className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center'} py-3 hover:bg-blue-50 transition-colors ${currentView === 'dataload' ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : 'text-gray-700'}`}
              >
                <Upload size={22} className={currentView === 'dataload' ? 'text-blue-600' : 'text-gray-500'} />
                {isSidebarOpen && <span className="font-medium text-sm">Cargar Variables</span>}
              </button>
            </li>
            
            {/* Separador */}
            <div className={`my-3 border-t border-gray-200 ${isSidebarOpen ? 'mx-4' : 'mx-3'}`}></div>
            
            <li>
              <button 
                onClick={() => setCurrentView('gps')}
                className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center'} py-3 hover:bg-blue-50 transition-colors ${currentView === 'gps' ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : 'text-gray-700'}`}
              >
                <MapPin size={22} className={currentView === 'gps' ? 'text-blue-600' : 'text-gray-500'} />
                {isSidebarOpen && <span className="font-medium text-sm">Ubicación GPS</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('tires')}
                className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center'} py-3 hover:bg-blue-50 transition-colors ${currentView === 'tires' ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : 'text-gray-700'}`}
              >
                <CircleDot size={22} className={currentView === 'tires' ? 'text-blue-600' : 'text-gray-500'} />
                {isSidebarOpen && <span className="font-medium text-sm">Control Llantas</span>}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setCurrentView('fuel')}
                className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center'} py-3 hover:bg-blue-50 transition-colors ${currentView === 'fuel' ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : 'text-gray-700'}`}
              >
                <Fuel size={22} className={currentView === 'fuel' ? 'text-blue-600' : 'text-gray-500'} />
                {isSidebarOpen && <span className="font-medium text-sm">Rendimiento Comb.</span>}
              </button>
            </li>
          </ul>
        </nav>

        {/* Footer Credits */}
        <div className={`border-t border-gray-200 ${isSidebarOpen ? 'p-4' : 'p-2'}`}>
          {isSidebarOpen ? (
            <div className="text-center text-gray-500 text-[10px] leading-tight">
              <p className="font-medium">Desarrollador</p>
              <p>Juan Felipe Granados</p>
              <p className="mt-1">2025 V0.1</p>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-[8px]">
              <p>V0.1</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800 capitalize">
            {getTitle()}
          </h2>
          
          {/* User Info Header - Horizontal Layout */}
          <div className="flex items-center gap-2">
            <UserInfoHeader horizontal={true} userName={currentUser?.name} />
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <ExportMenu 
              fleet={fleet}
              workOrders={workOrders}
              variableHistory={variableHistory}
              setFleet={setFleet}
              setWorkOrders={setWorkOrders}
              setVariableHistory={setVariableHistory}
              dashboardStats={{
                totalVehicles: fleet.length,
                activeVehicles: fleet.filter(v => v.status === 'Activo').length,
                completedOTs: workOrders.filter(ot => ot.status === 'completed').length,
                pendingOTs: workOrders.filter(ot => ot.status !== 'completed').length,
                totalKm: fleet.reduce((sum, v) => sum + (v.currentKm || 0), 0),
                avgKm: fleet.length > 0 ? Math.round(fleet.reduce((sum, v) => sum + (v.currentKm || 0), 0) / fleet.length) : 0
              }}
            />
            <NotificationBadge fleet={fleet} workOrders={workOrders} />
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Cerrar Sesión"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </header>
        
        {renderView()}
      </main>
    </div>
  );
}

export default App;
