import { MAINTENANCE_ROUTINES } from '../data';
import { detectRoutineVariant, pickVariantRoutine } from '../utils/maintenance';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const normalizeSupplyUnit = (supply) => {
  if (supply == null) return null;

  const asObject = typeof supply === 'object' && !Array.isArray(supply);
  const rawName = asObject ? (supply.name || supply.description || supply.descripcion || '') : String(supply);
  const nameUpper = String(rawName || '').toUpperCase();

  const rawUnit = asObject ? (supply.unit || supply.unidad) : null;
  const unitUpper = rawUnit != null ? String(rawUnit).toUpperCase().trim() : '';

  if (nameUpper.includes('FILTRO')) {
    return asObject ? { ...supply, unit: 'UND' } : { name: rawName, unit: 'UND', quantity: 1 };
  }

  const isFluid =
    nameUpper.includes('ACEITE') ||
    nameUpper.includes('REFRIGERANTE') ||
    nameUpper.includes('LIQUIDO') ||
    nameUpper.includes('LÍQUIDO') ||
    nameUpper.includes('FLUID');

  if (isFluid) {
    return asObject ? { ...supply, unit: 'GLN' } : { name: rawName, unit: 'GLN', quantity: 1 };
  }

  if (unitUpper) {
    return asObject ? { ...supply, unit: unitUpper } : { name: rawName, unit: unitUpper, quantity: 1 };
  }

  return asObject ? { ...supply, unit: 'UND' } : { name: rawName, unit: 'UND', quantity: 1 };
};

const normalizeSuppliesUnits = (supplies) => {
  if (!Array.isArray(supplies)) return [];
  return supplies
    .map(normalizeSupplyUnit)
    .filter(Boolean);
};

const taskSystemFromDescription = (description) => {
  const upper = String(description || '').toUpperCase();
  if (!upper.trim()) return 'INSPECCION';

  if (upper.includes('MOTOR')) return 'SISTEMA MOTOR';
  if (upper.includes('TRANSMISI') || upper.includes('CAJA')) return 'SISTEMA TRANSMISION';
  if (upper.includes('FRENO')) return 'SISTEMA FRENOS';
  if (upper.includes('DIRECCION') || upper.includes('DIRECCIÓN')) return 'SISTEMA DIRECCION';
  if (upper.includes('REFRIGERANTE') || upper.includes('RADIADOR') || upper.includes('ENFRIAM')) return 'SISTEMA REFRIGERACION';
  if (upper.includes('SUSPENS') || upper.includes('AMORTIGUADOR')) return 'SISTEMA SUSPENSION';
  if (upper.includes('LLANTA') || upper.includes('NEUMATIC')) return 'SISTEMA LLANTAS';
  if (upper.includes('BATERIA') || upper.includes('BATERÍA') || upper.includes('LUCES') || upper.includes('ELECTRIC')) return 'SISTEMA ELECTRICO';

  return 'INSPECCION';
};

const generateTaskCode = (description) => {
  const upperDesc = String(description || '').toUpperCase();

  if (upperDesc.includes('ACEITE DE MOTOR') && upperDesc.includes('CAMBIAR')) return 'CAMB-ACMOT';
  if (upperDesc.includes('ACEITE DE LA TRANSMISION') && upperDesc.includes('CAMBIAR')) return 'CAMB-ACTRA';
  if (upperDesc.includes('FILTRO DE ACEITE') && upperDesc.includes('CAMBIAR')) return 'CAMB-FLMOT';
  if (upperDesc.includes('FILTRO DE COMBUSTIBLE') && upperDesc.includes('CAMBIAR')) return 'CAMB-FCOMB';
  if (upperDesc.includes('FILTRO DE AIRE') && upperDesc.includes('CAMBIAR')) return 'CAMB-FAIRE';
  if (upperDesc.includes('FILTRO DE AIRE ACONDICIONADO')) return 'CAMB-FAIREAC';
  if (upperDesc.includes('TANQUE DE COMBUSTIBLE') && (upperDesc.includes('LIMPIEZA') || upperDesc.includes('LAVADO'))) return 'LIMP-TQCMB';
  if (upperDesc.includes('ESTRUCTURA DE LA EMBARCACION')) return 'REV-ESEMB';
  if (upperDesc.includes('ESTADO DEL MOTOR')) return 'REV-MOT';
  if (upperDesc.includes('SWICHT DE ENCENDIDO')) return 'REV-SWICHT';
  if (upperDesc.includes('CORREAS')) return 'REV-AJCORR';
  if (upperDesc.includes('BATERIAS')) return 'REV-BAT';
  if (upperDesc.includes('SISTEMA DE ARRANQUE')) return 'REV-ARRNQ';
  if (upperDesc.includes('TABLERO')) return 'REV-CABTC';
  if (upperDesc.includes('FRENOS') && upperDesc.includes('LIQUIDO')) return 'CAMB-LQFRN';
  if (upperDesc.includes('REFRIGERANTE')) return 'REV-NIVREF';
  if (upperDesc.includes('DIRECCION') && upperDesc.includes('ACEITE')) return 'REV-NIVDIR';
  if (upperDesc.includes('SISTEMA DE FRENOS')) return 'REV-SISFRN';
  if (upperDesc.includes('PASTILLAS DE FRENO')) return 'REV-PSTFRN';
  if (upperDesc.includes('DISCOS DE FRENO')) return 'REV-DSCFRN';
  if (upperDesc.includes('AMORTIGUADORES')) return 'REV-AMORT';
  if (upperDesc.includes('LLANTAS')) return 'REV-LLANT';
  if (upperDesc.includes('LUCES')) return 'REV-LUCES';

  const words = upperDesc.split(' ').filter(Boolean);
  const action = (words[0] || 'REV').substring(0, 4);
  const object = words.slice(1).map(w => w[0]).join('').substring(0, 5);
  return `${action}-${object}`;
};

export const getBase64ImageFromURL = (url) => {
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

const buildWorkOrderPdfDocument = async (workOrder) => {
  const formatMonthYear = (value) => {
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

    let dateObj = null;
    if (value instanceof Date) {
      dateObj = value;
    } else if (typeof value === 'string' && value.trim()) {
      const v = value.trim();
      const m1 = v.match(/^([0-3]?\d)\/(\d{1,2})\/(\d{4})$/);
      if (m1) {
        const day = Number(m1[1]);
        const month = Number(m1[2]) - 1;
        const year = Number(m1[3]);
        dateObj = new Date(year, month, day);
      } else {
        const parsed = new Date(v);
        if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
      }
    }

    if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
    const mon = months[dateObj.getMonth()] || '';
    const yy = String(dateObj.getFullYear()).slice(-2);
    return mon && yy ? `${mon}-${yy}` : '';
  };

  const doc = new jsPDF();

  const startX = 10;
  const startY = 10;
  const headerHeight = 30;
  const fullWidth = 190;

  doc.setDrawColor(0);
  doc.setLineWidth(0.1);
  doc.rect(startX, startY, fullWidth, headerHeight);

  doc.line(startX + 60, startY, startX + 60, startY + headerHeight);
  doc.line(startX + 140, startY, startX + 140, startY + headerHeight);

  try {
    const logoBase64 = await getBase64ImageFromURL('/logo.png');
    doc.addImage(logoBase64, 'PNG', startX + 10, startY + 1.5, 40, 27);
  } catch (e) {
    console.error('Error loading logo:', e);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('GRUPORTIZ', startX + 30, startY + 15, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  const titleCenterX = startX + 60 + (80 / 2);
  doc.text('FORMATO EJECUCION', titleCenterX, startY + 10, { align: 'center' });
  doc.text('MANTENIMIENTO PREVENTIVOS', titleCenterX, startY + 15, { align: 'center' });
  doc.text('VEHICULOS LIVIANOS (CAMIONETAS)', titleCenterX, startY + 20, { align: 'center' });

  doc.line(startX + 140, startY + 15, startX + fullWidth, startY + 15);

  doc.setFontSize(8);
  doc.text('OT CONSECUTIVO', startX + 140 + 25, startY + 5, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(String(workOrder.otNumber ?? workOrder.id), startX + 140 + 25, startY + 12, { align: 'center' });

  const headerCode = 'FEYM936.00.CO';
  const headerDate = formatMonthYear(workOrder.creationDate) || formatMonthYear(workOrder.createdAt) || formatMonthYear(new Date());
  doc.setFontSize(10);
  doc.text(headerCode, startX + 140 + 25, startY + 24, { align: 'center' });
  doc.setFontSize(8);
  doc.text(headerDate, startX + 140 + 25, startY + 29, { align: 'center' });

  const infoStartY = startY + headerHeight + 5;

  const serialNumber =
    workOrder?.vin ||
    workOrder?.serieChasis ||
    workOrder?.vehicle?.vin ||
    workOrder?.vehicle?.serieChasis ||
    '';

  const areaOperativa = workOrder.area || '40BU-TM1-TM2';

  const infoData = [
    ['CENTRO OPERACION', '40BU-TRONCALES', 'AREA OPERATIVA', areaOperativa],
    ['PROCESO', 'MTTO-PREVENTIVO', 'UBICACION', workOrder.workshop || 'TALLER EL HATO'],
    ['ACTIVO', workOrder.vehicleCode || workOrder.vehicleModel, 'PLACA', workOrder.plate],
    ['FUNCION', 'TRANSPORTE DE PERSONAL', 'TIPO OT', 'S'],
    ['DESCRIPCION CORTA', workOrder.vehicleModel, 'NO. SERIE', serialNumber]
  ];

  doc.autoTable({
    startY: infoStartY,
    body: infoData,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, lineColor: 0, lineWidth: 0.1, textColor: 0 },
    columnStyles: { 0: { cellWidth: 35, fontStyle: 'bold' }, 1: { cellWidth: 60 }, 2: { cellWidth: 35, fontStyle: 'bold' }, 3: { cellWidth: 60 } },
    margin: { left: 10, right: 10 }
  });

  const getSignatureImage = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return value.image || value.dataUrl || value.dataURL || null;
    return null;
  };

  const getSignatureName = (value) => {
    if (!value || typeof value !== 'object') return '';
    return String(value.name || '').trim();
  };

  const getSignaturePosition = (value) => {
    if (!value || typeof value !== 'object') return '';
    return String(value.position || value.cargo || '').trim();
  };

  const ensureSpace = (y, neededHeight = 0) => {
    const pageHeight = doc.internal?.pageSize?.getHeight?.() ?? 297;
    const bottomMargin = 10;
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      return 20;
    }
    return y;
  };

  const signatures = workOrder?.signatures || null;
  const responsibleSig = signatures?.responsible ?? workOrder?.signatureResponsible ?? null;
  const receivedSig = signatures?.received ?? workOrder?.signatureReceived ?? null;
  const approverName = signatures?.approver ?? workOrder?.signatureApprover ?? '';

  const responsibleImg = getSignatureImage(responsibleSig);
  const receivedImg = getSignatureImage(receivedSig);
  const hasAnySignature = Boolean(responsibleImg || receivedImg || approverName);

  if (hasAnySignature) {
    let y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : 260;
    y = ensureSpace(y, 60);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('FIRMAS', 14, y);

    const boxY = y + 4;
    const boxH = 22;
    const boxW = 88;
    const leftX = 10;
    const rightX = 112;

    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.rect(leftX, boxY, boxW, boxH);
    doc.rect(rightX, boxY, boxW, boxH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RESPONSABLE', leftX + 2, boxY - 1);
    doc.text('RECIBE A SATISFACCION', rightX + 2, boxY - 1);

    const imgPadding = 2;
    const imgY = boxY + imgPadding;
    const imgH = boxH - imgPadding * 2;
    const imgW = boxW - imgPadding * 2;

    if (responsibleImg) {
      try {
        doc.addImage(responsibleImg, 'PNG', leftX + imgPadding, imgY, imgW, imgH);
      } catch (e) {
        console.warn('No se pudo insertar firma responsable en PDF:', e);
      }
    }

    if (receivedImg) {
      try {
        doc.addImage(receivedImg, 'PNG', rightX + imgPadding, imgY, imgW, imgH);
      } catch (e) {
        console.warn('No se pudo insertar firma recibe en PDF:', e);
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const respName = getSignatureName(responsibleSig);
    const respPos = getSignaturePosition(responsibleSig);
    const recvName = getSignatureName(receivedSig);
    const recvPos = getSignaturePosition(receivedSig);

    const textY = boxY + boxH + 5;
    if (respName || respPos) {
      doc.text([respName, respPos].filter(Boolean).join(' — '), leftX, textY);
    }
    if (recvName || recvPos) {
      doc.text([recvName, recvPos].filter(Boolean).join(' — '), rightX, textY);
    }

    if (approverName) {
      doc.setFont('helvetica', 'bold');
      doc.text(`APROBO:`, 14, textY + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(String(approverName), 32, textY + 8);
    }
  }

  const finalY = doc.lastAutoTable.finalY;

  const ensureArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const parseRoutineKm = (value) => {
    if (typeof value === 'number') return value;
    if (!value) return null;
    const match = String(value).match(/(\d{4,6})\s*KM/i);
    return match ? Number(match[1]) : null;
  };

  const routineKm =
    typeof workOrder?.routine === 'number'
      ? workOrder.routine
      : parseRoutineKm(workOrder?.routineName);

  const fallbackRoutine =
    typeof routineKm === 'number' && MAINTENANCE_ROUTINES?.[routineKm]
      ? pickVariantRoutine(MAINTENANCE_ROUTINES[routineKm], detectRoutineVariant(workOrder?.vehicleModel))
      : null;

  const itemsToRender = (() => {
    const items = ensureArray(workOrder?.items);
    if (items.length) return items;
    const fallbackItems = ensureArray(fallbackRoutine?.items);
    return fallbackItems;
  })();

  const suppliesToRender = (() => {
    const supplies = ensureArray(workOrder?.supplies);
    if (supplies.length) return supplies;
    const fallbackSupplies = ensureArray(fallbackRoutine?.supplies);
    return fallbackSupplies;
  })();

  const normalizedSuppliesToRender = normalizeSuppliesUnits(suppliesToRender);

  doc.autoTable({
    startY: finalY + 2,
    head: [['CODIGO', 'DESCRIPCION', 'SISTEMA', 'EJECUCION']],
    body: itemsToRender.map(item => [
      generateTaskCode(item.description),
      item.description,
      taskSystemFromDescription(item.description),
      '[ ] OK   [ ] NO'
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, lineColor: 0, lineWidth: 0.1, textColor: 0 },
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 95 }, 2: { cellWidth: 40 }, 3: { cellWidth: 30, halign: 'center' } },
    margin: { left: 10, right: 10 }
  });

  const repuestosY = doc.lastAutoTable.finalY + 10;
  doc.text('REPUESTOS / MATERIALES UTILIZADOS', 14, repuestosY);

  doc.autoTable({
    startY: repuestosY + 3,
    head: [['FECHA', 'BODEGA', 'REPUESTO', 'DESCRIPCION', 'UND', 'CANT', 'VL. TOTAL']],
    body: normalizedSuppliesToRender.map(s => [
      new Date().toLocaleDateString(),
      'BODEGA',
      (s && typeof s === 'object' ? (s.reference || s.codigo || s.ref) : '') || '---',
      (s && typeof s === 'object' ? (s.name || s.description || s.descripcion) : s) || '---',
      String((s && typeof s === 'object' ? (s.unit || s.unidad) : null) || 'UND').toUpperCase(),
      (s && typeof s === 'object' ? (s.quantity ?? s.cantidad) : null) || '1',
      ''
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 1.5, lineColor: 0, lineWidth: 0.1, textColor: 0 },
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'left' }, 3: { halign: 'left' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' } },
    margin: { left: 10, right: 10 }
  });

  const filename = `OT_${workOrder.otNumber ?? workOrder.id}_${workOrder.plate || ''}.pdf`;
  return { doc, filename };
};

export const generatePDF = async (workOrder, notify) => {
  const notifyFn = typeof notify === 'function' ? notify : null;

  try {
    const built = await buildWorkOrderPdfDocument(workOrder);
    if (!built?.doc) return;
    built.doc.save(built.filename);
  } catch (e) {
    console.error('Error generating PDF:', e);
    if (notifyFn) {
      await notifyFn('Error generando el PDF de la OT.', { title: 'Error', variant: 'danger' });
    }
  }
};

export const generatePDFBlobUrl = async (workOrder, notify) => {
  const notifyFn = typeof notify === 'function' ? notify : null;

  try {
    const built = await buildWorkOrderPdfDocument(workOrder);
    if (!built?.doc) return null;
    const blob = built.doc.output('blob');
    const url = URL.createObjectURL(blob);
    return { url, filename: built.filename };
  } catch (e) {
    console.error('Error generating PDF blob:', e);
    if (notifyFn) {
      await notifyFn('Error preparando la vista previa del PDF.', { title: 'Error', variant: 'danger' });
    }
    return null;
  }
};
