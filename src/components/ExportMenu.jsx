import { useState, useRef } from 'react';
import { Download, FileText, FileSpreadsheet, X, Check, Loader2, Database, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useDialog } from './DialogProvider.jsx';

export default function ExportMenu({ fleet, workOrders, variableHistory, dashboardStats, setFleet, setWorkOrders, setVariableHistory }) {
  const dialog = useDialog();
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState('');
  const fileInputRef = useRef(null);

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
      await dialog.alert({ title: 'Error', message: 'Error al generar el archivo Excel', variant: 'danger' });
      setExporting(false);
      setExportType('');
    }
  };

  const exportBackupJSON = () => {
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        fleet,
        workOrders,
        variableHistory
      },
      stats: dashboardStats
    };

    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CONTROL_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    setIsOpen(false);
  };

  const importBackupJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        
        if (!backup.data) {
          await dialog.alert({ title: 'Backup inválido', message: 'Archivo de backup inválido', variant: 'warning' });
          return;
        }

        if (backup.data.fleet) {
          setFleet(backup.data.fleet);
          localStorage.setItem('fleet_data', JSON.stringify(backup.data.fleet));
        }
        if (backup.data.workOrders) {
          setWorkOrders(backup.data.workOrders);
          localStorage.setItem('work_orders', JSON.stringify(backup.data.workOrders));
        }
        if (backup.data.variableHistory) {
          setVariableHistory(backup.data.variableHistory);
          localStorage.setItem('variable_history', JSON.stringify(backup.data.variableHistory));
        }

        await dialog.alert({
          title: 'Backup restaurado',
          message: `✅ Backup restaurado correctamente\n\n` +
            `Vehículos: ${backup.data.fleet?.length || 0}\n` +
            `Órdenes: ${backup.data.workOrders?.length || 0}\n` +
            `Historial: ${backup.data.variableHistory?.length || 0}`,
          variant: 'success'
        });
        
        setIsOpen(false);
        window.location.reload(); // Recargar para aplicar cambios
      } catch (error) {
        console.error('Error al importar backup:', error);
        await dialog.alert({ title: 'Error', message: 'Error al leer el archivo de backup', variant: 'danger' });
      }
    };
    reader.readAsText(file);
  };

  const backupOptions = [
    {
      id: 'backup',
      title: '💾 Backup Completo',
      description: 'Descargar todos los datos (JSON)',
      icon: <Database className="w-4 h-4 text-green-600" />,
      action: exportBackupJSON,
      color: 'bg-green-50 hover:bg-green-100 border-green-200'
    },
    {
      id: 'restore',
      title: '📥 Restaurar Backup',
      description: 'Importar datos desde JSON',
      icon: <Upload className="w-4 h-4 text-blue-600" />,
      action: () => fileInputRef.current?.click(),
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200'
    }
  ];

  const excelOptions = [
    {
      id: 'complete',
      title: '📊 Exportación Completa',
      description: 'Todas las hojas',
      icon: <FileSpreadsheet className="w-4 h-4 text-green-600" />
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={importBackupJSON}
                className="hidden"
              />
              
              {/* Backup/Restore Section */}
              <div className="mb-2">
                {backupOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => option.action()}
                    disabled={exporting}
                    className={`w-full p-2.5 mb-1 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left border ${option.color}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex-shrink-0">
                        <div className="w-4 h-4 flex items-center justify-center">
                          {option.icon}
                        </div>
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

              {/* Separator */}
              <div className="border-t border-slate-200 my-2"></div>
              <p className="text-xs text-slate-500 font-semibold px-2 py-1">EXPORTAR A EXCEL</p>

              {/* Excel Export Section */}
              {excelOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => exportToExcel(option.id)}
                  disabled={exporting}
                  className="w-full p-2.5 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left border border-transparent hover:border-slate-200 hover:bg-slate-50"
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
