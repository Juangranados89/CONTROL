import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, X, Check, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ExportMenu({ fleet, workOrders, variableHistory, dashboardStats }) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState('');

  const exportToExcel = async (type) => {
    setExporting(true);
    setExportType(type);

    try {
      const workbook = XLSX.utils.book_new();

      if (type === 'complete' || type === 'fleet') {
        // Hoja de Flota
        const fleetData = fleet.map(v => ({
          'Placa': v.plate,
          'Tipo': v.type,
          'Marca': v.brand,
          'Modelo': v.model,
          'Año': v.year,
          'Kilometraje Actual': v.currentKm,
          'Próximo Mantenimiento': v.nextMaintenanceKm,
          'Faltante (KM)': (v.nextMaintenanceKm || 0) - (v.currentKm || 0),
          'Estado': v.status,
          'Última Actualización': v.lastUpdate || 'N/A'
        }));
        const fleetSheet = XLSX.utils.json_to_sheet(fleetData);
        XLSX.utils.book_append_sheet(workbook, fleetSheet, 'Flota');
      }

      if (type === 'complete' || type === 'workorders') {
        // Hoja de OT
        const otData = workOrders.map(ot => ({
          'Número OT': ot.otNumber,
          'Placa': ot.vehiclePlate,
          'Tipo Mantenimiento': ot.maintenanceType,
          'Fecha Creación': ot.createdDate,
          'Fecha Vencimiento': ot.dueDate || 'N/A',
          'Estado': ot.status === 'completed' ? 'Completada' : ot.status === 'in-progress' ? 'En Progreso' : 'Pendiente',
          'Kilometraje Ejecución': ot.executionKm || 'N/A',
          'Observaciones': ot.notes || ''
        }));
        const otSheet = XLSX.utils.json_to_sheet(otData);
        XLSX.utils.book_append_sheet(workbook, otSheet, 'Órdenes de Trabajo');
      }

      if (type === 'complete' || type === 'history') {
        // Hoja de Historial
        const historyData = variableHistory.map(h => ({
          'Fecha': h.date,
          'Placa': h.vehiclePlate,
          'Kilometraje': h.mileage,
          'Cambio': h.change || 0,
          'Usuario': h.updatedBy || 'Sistema'
        }));
        const historySheet = XLSX.utils.json_to_sheet(historyData);
        XLSX.utils.book_append_sheet(workbook, historySheet, 'Historial Variables');
      }

      if (type === 'complete' && dashboardStats) {
        // Hoja de Estadísticas
        const statsData = [
          { 'Métrica': 'Total Vehículos', 'Valor': dashboardStats.totalVehicles || 0 },
          { 'Métrica': 'Vehículos Activos', 'Valor': dashboardStats.activeVehicles || 0 },
          { 'Métrica': 'OT Completadas', 'Valor': dashboardStats.completedOTs || 0 },
          { 'Métrica': 'OT Pendientes', 'Valor': dashboardStats.pendingOTs || 0 },
          { 'Métrica': 'Kilometraje Total', 'Valor': dashboardStats.totalKm || 0 },
          { 'Métrica': 'Promedio KM/Vehículo', 'Valor': dashboardStats.avgKm || 0 }
        ];
        const statsSheet = XLSX.utils.json_to_sheet(statsData);
        XLSX.utils.book_append_sheet(workbook, statsSheet, 'Estadísticas');
      }

      // Generar archivo
      const fileName = `Control_Fleet_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setTimeout(() => {
        setExporting(false);
        setExportType('');
        setIsOpen(false);
      }, 1000);
    } catch (error) {
      console.error('Error exportando:', error);
      alert('Error al generar el archivo Excel');
      setExporting(false);
      setExportType('');
    }
  };

  const exportOptions = [
    {
      id: 'complete',
      title: 'Exportación Completa',
      description: 'Todas las hojas',
      icon: <FileSpreadsheet className="w-4 h-4 text-slate-600" />
    },
    {
      id: 'fleet',
      title: 'Solo Flota',
      description: 'Vehículos',
      icon: <FileSpreadsheet className="w-4 h-4 text-slate-600" />
    },
    {
      id: 'workorders',
      title: 'Solo OT',
      description: 'Órdenes de trabajo',
      icon: <FileText className="w-4 h-4 text-slate-600" />
    },
    {
      id: 'history',
      title: 'Solo Historial',
      description: 'Cambios de KM',
      icon: <FileText className="w-4 h-4 text-slate-600" />
    }
  ];

  return (
    <div className="relative">
      {/* Export Button - Minimalist Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative"
        title="Exportar datos"
      >
        <Download className="w-5 h-5 text-slate-600" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50">
            {/* Header */}
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-slate-800">Exportar</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="p-2">
              {exportOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => exportToExcel(option.id)}
                  disabled={exporting}
                  className="w-full p-2.5 rounded-md hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left border border-transparent hover:border-slate-200"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex-shrink-0">
                      {exporting && exportType === option.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <div className="w-4 h-4 flex items-center justify-center">
                          {option.icon}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-700">
                        {option.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
