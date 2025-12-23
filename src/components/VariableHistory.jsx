import { useState, useMemo } from 'react';
import { Calendar, Filter, Download, Search, Trash2 } from 'lucide-react';
import { useDialog } from './DialogProvider.jsx';
import safeLocalStorage from '../utils/safeStorage';

export default function VariableHistory({ variableHistory, fleet, setVariableHistory, setFleet }) {
  const dialog = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedVehicle, setSelectedVehicle] = useState('ALL');

  // Function to delete a record
  const handleDeleteRecord = async (recordId) => {
    const ok = await dialog.confirm({
      title: 'Confirmar eliminación',
      message: '¿Está seguro de eliminar este registro del historial?',
      variant: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    });

    if (ok) {
      const deletedRecord = variableHistory.find(h => h.id === recordId);
      const updatedHistory = variableHistory.filter(h => h.id !== recordId);
      setVariableHistory(updatedHistory);
      safeLocalStorage.setItem('variable_history', JSON.stringify(updatedHistory));
      
      // Recalcular última variable del vehículo desde historial restante
      if (deletedRecord && setFleet && fleet) {
        const vehicleHistory = updatedHistory
          .filter(h => h.plate === deletedRecord.plate || h.code === deletedRecord.code)
          .sort((a, b) => {
            const dateA = new Date(a.date?.split(' ')[0]?.split('/').reverse().join('-') + ' ' + (a.date?.split(' ')[1] || '00:00:00'));
            const dateB = new Date(b.date?.split(' ')[0]?.split('/').reverse().join('-') + ' ' + (b.date?.split(' ')[1] || '00:00:00'));
            return dateB - dateA;
          });
        
        const lastRecord = vehicleHistory[0];
        const vehicleIndex = fleet.findIndex(v => v.plate === deletedRecord.plate || v.code === deletedRecord.code);
        
        if (vehicleIndex !== -1) {
          const updatedFleet = [...fleet];
          updatedFleet[vehicleIndex] = {
            ...updatedFleet[vehicleIndex],
            mileage: lastRecord ? lastRecord.mileage || lastRecord.km : 0,
            lastVariableDate: lastRecord ? lastRecord.date : ''
          };
          setFleet(updatedFleet);
          safeLocalStorage.setItem('fleet_data', JSON.stringify(updatedFleet));
        }
      }
      
      await dialog.alert({ title: 'Registro eliminado', message: '✅ Registro eliminado correctamente', variant: 'success' });
    }
  };

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    let filtered = [...variableHistory];

    // Filter by vehicle
    if (selectedVehicle !== 'ALL') {
      filtered = filtered.filter(h => 
        h.plate === selectedVehicle || h.code === selectedVehicle
      );
    }

    // Filter by search term (plate or code)
    if (searchTerm) {
      filtered = filtered.filter(h =>
        h.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by date range
    if (dateRange.start) {
      filtered = filtered.filter(h => {
        const recordDate = new Date(h.date);
        const startDate = new Date(dateRange.start);
        return recordDate >= startDate;
      });
    }

    if (dateRange.end) {
      filtered = filtered.filter(h => {
        const recordDate = new Date(h.date);
        const endDate = new Date(dateRange.end);
        return recordDate <= endDate;
      });
    }

    // Sort by date DESC (most recent first)
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [variableHistory, selectedVehicle, searchTerm, dateRange]);

  // Group by vehicle for summary
  const vehicleSummary = useMemo(() => {
    const summary = {};
    
    variableHistory.forEach(record => {
      const key = record.plate || record.code;
      if (!summary[key]) {
        summary[key] = {
          plate: record.plate,
          code: record.code,
          records: [],
          firstUpdate: record.date,
          lastUpdate: record.date,
          totalUpdates: 0,
          currentKm: record.km
        };
      }
      
      summary[key].records.push(record);
      summary[key].totalUpdates++;
      summary[key].currentKm = Math.max(summary[key].currentKm, record.km);
      
      if (new Date(record.date) < new Date(summary[key].firstUpdate)) {
        summary[key].firstUpdate = record.date;
      }
      if (new Date(record.date) > new Date(summary[key].lastUpdate)) {
        summary[key].lastUpdate = record.date;
      }
    });

    return Object.values(summary);
  }, [variableHistory]);

  const exportToCSV = () => {
    const headers = ['Fecha', 'Placa', 'Código', 'Kilometraje', 'Cambio', 'Usuario'];
    const rows = filteredHistory.map(h => [
      h.date,
      h.plate || '',
      h.code || '',
      h.km,
      h.change || 0,
      h.updatedBy || 'Sistema'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_variables_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-blue-600" />
                Historial de Variables
              </h1>
              <p className="text-slate-600 mt-1">
                {filteredHistory.length} registros encontrados
              </p>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-5 h-5" />
              Exportar CSV
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar placa o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Vehicle Filter */}
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Todos los vehículos</option>
              {fleet.map(v => (
                <option key={v.id} value={v.plate}>
                  {v.plate} - {v.code}
                </option>
              ))}
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Fecha inicio"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Fecha fin"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Total Registros</p>
            <p className="text-3xl font-bold text-slate-800">{variableHistory.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Vehículos con Historial</p>
            <p className="text-3xl font-bold text-slate-800">{vehicleSummary.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Última Actualización</p>
            <p className="text-lg font-bold text-slate-800">
              {variableHistory.length > 0 
                ? new Date(variableHistory[variableHistory.length - 1].date).toLocaleDateString('es-ES')
                : 'N/A'
              }
            </p>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Placa</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Código</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Kilometraje</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Cambio</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Usuario</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      No hay registros para mostrar
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((record, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {new Date(record.date).toLocaleString('es-ES')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {record.plate}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {record.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-800">
                        {record.km?.toLocaleString()} KM
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-mono ${
                        record.change > 0 ? 'text-green-600' : 'text-slate-400'
                      }`}>
                        {record.change > 0 ? '+' : ''}{record.change?.toLocaleString()} KM
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {record.updatedBy || 'Sistema'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar registro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicle Summary */}
        {vehicleSummary.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Resumen por Vehículo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicleSummary.map((vehicle, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4">
                  <p className="font-bold text-slate-800">{vehicle.plate}</p>
                  <p className="text-sm text-slate-600 mb-2">{vehicle.code}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total actualizaciones:</span>
                      <span className="font-semibold">{vehicle.totalUpdates}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">KM actual:</span>
                      <span className="font-semibold">{vehicle.currentKm?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Primera:</span>
                      <span className="text-xs">{new Date(vehicle.firstUpdate).toLocaleDateString('es-ES')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Última:</span>
                      <span className="text-xs">{new Date(vehicle.lastUpdate).toLocaleDateString('es-ES')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
