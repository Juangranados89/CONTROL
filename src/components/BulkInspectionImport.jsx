import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, AlertCircle, CheckCircle, X, Save, FileSpreadsheet } from 'lucide-react';
import api from '../api';
import { useDialog } from './DialogProvider';

export default function BulkInspectionImport({ onClose, onSuccess }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const dialog = useDialog();

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Read with header at row 3 (index 3)
        const rawData = XLSX.utils.sheet_to_json(ws, { range: 3, defval: '' });
        
        // Map data
        const mapped = rawData.map((row, idx) => {
          // Helper to parse date
          let date = row['FECHA INSP.'];
          if (!(date instanceof Date) && date) {
             date = new Date(date);
          }
          if (!date || isNaN(date.getTime())) {
             date = new Date(); // Default to now if missing
          }

          return {
            id: idx,
            vehicleIdentifier: String(row['COD. FLOTA'] || row['# INTERNO VEH.'] || '').trim(),
            vehicleInternalCode: String(row['# INTERNO VEH.'] || '').trim(),
            vehicleType: String(row['EQUIPO'] || '').trim(),
            vehicleArea: String(row['PLANTA'] || '').trim(),
            position: row['UBICAC'],
            tireMarking: String(row['MARCACION'] || '').trim(),
            brand: String(row['MARCA'] || '').trim(),
            model: String(row['DISEÑO'] || '').trim(),
            size: String(row['DIMENSION'] || '').trim(),
            application: String(row['APLICACION'] || '').trim(),
            condition: String(row['NUEVA/REE'] || '').trim() === 'N' ? 'NEW' : (String(row['NUEVA/REE'] || '').trim() === 'R' ? 'RETREAD' : 'USED'),
            inspectedAt: date.toISOString(),
            odometerKm: row['KILOMETRAJE.1'] || row['KILOMETRAJE_1'] || row['KILOMETRAJE'],
            psiCold: row['PSI ENC'],
            // SheetJS handles duplicate headers by appending _1, _2 etc.
            // The first EXT/CEN/INT (cols 19-21) are mounting depths.
            // The second EXT/CEN/INT (cols 29-31) are inspection depths.
            depthExt: row['EXT_1'] || row['EXT.1'] || row['EXT'],
            depthCen: row['CEN_1'] || row['CEN.1'] || row['CEN'],
            depthInt: row['INT_1'] || row['INT.1'] || row['INT'],
            originalDepth: row['RTD ORIG'],
            remainingMm: row['mm Remanente'],
            wearPercent: row['% De Desgaste'],
            actionRotate: !!row['Rotar'],
            actionAlign: !!row['Alinear'],
            actionRemoveFromService: !!row['Sacar de Servicio'],
            notes: String(row['OBSERVACION'] || '').trim(),
            raw: row
          };
        }).filter(r => r.vehicleIdentifier && r.tireMarking && r.position); // Filter invalid rows

        if (mapped.length === 0) {
          setError('No se encontraron filas válidas. Verifique que el Excel tenga las columnas correctas (COD. FLOTA, MARCACION, UBICAC).');
        } else {
          setData(mapped);
        }
      } catch (err) {
        setError('Error al leer el archivo: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleImport = async () => {
    if (data.length === 0) return;
    
    const ok = await dialog.confirm({
      title: 'Confirmar importación',
      message: `Se importarán ${data.length} registros de inspección. Esto actualizará montajes y creará inspecciones nuevas. ¿Continuar?`
    });
    if (!ok) return;

    setLoading(true);
    try {
      const resp = await api.request('/api/tires/import-inspections', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setResults(resp);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError('Error en la importación: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Importar Inspecciones</h2>
              <p className="text-xs text-slate-500">Carga masiva desde Excel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-6 bg-slate-50/50">
          {!results ? (
            <>
              {/* Upload Area */}
              <div className="mb-6">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-slate-400" />
                    <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click para subir</span> o arrastra el archivo Excel</p>
                    <p className="text-xs text-slate-500">Formato estándar de inspección</p>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} />
                </label>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-200">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}

              {/* Preview Table */}
              {data.length > 0 && (
                <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-white shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3">Vehículo</th>
                        <th className="px-4 py-3">Pos</th>
                        <th className="px-4 py-3">Llanta</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Prof (mm)</th>
                        <th className="px-4 py-3">PSI</th>
                        <th className="px-4 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-bold text-slate-700">{row.vehicleIdentifier}</td>
                          <td className="px-4 py-2">{row.position}</td>
                          <td className="px-4 py-2">
                            <div className="font-mono text-xs">{row.tireMarking}</div>
                            <div className="text-[10px] text-slate-400">{row.brand} {row.model}</div>
                          </td>
                          <td className="px-4 py-2 text-slate-600">{new Date(row.inspectedAt).toLocaleDateString()}</td>
                          <td className="px-4 py-2 font-mono">{row.depthCen}</td>
                          <td className="px-4 py-2 font-mono">{row.psiCold}</td>
                          <td className="px-4 py-2 text-xs">
                            {row.actionRotate && <span className="bg-blue-100 text-blue-700 px-1 rounded mr-1">Rot</span>}
                            {row.actionAlign && <span className="bg-amber-100 text-amber-700 px-1 rounded mr-1">Ali</span>}
                            {row.actionRemoveFromService && <span className="bg-red-100 text-red-700 px-1 rounded">Baja</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Importación Completada</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 text-left bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <div className="text-sm text-slate-500">Procesados</div>
                  <div className="text-xl font-bold text-slate-800">{results.processed}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Creados</div>
                  <div className="text-xl font-bold text-green-600">{results.created}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Errores</div>
                  <div className="text-xl font-bold text-red-600">{results.errors.length}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Advertencias</div>
                  <div className="text-xl font-bold text-amber-600">{results.warnings.length}</div>
                </div>
              </div>
              
              {results.errors.length > 0 && (
                <div className="mt-6 w-full max-w-2xl max-h-48 overflow-auto bg-red-50 p-4 rounded-lg border border-red-200 text-left">
                  <h4 className="font-bold text-red-800 mb-2 text-sm">Detalle de Errores:</h4>
                  <ul className="text-xs text-red-700 space-y-1">
                    {results.errors.map((e, i) => (
                      <li key={i}>
                        <span className="font-semibold">Fila {e.row?.id}:</span> {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-2">
          {!results ? (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold">
                Cancelar
              </button>
              <button 
                onClick={handleImport} 
                disabled={loading || data.length === 0}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Procesando...' : (
                  <>
                    <Save size={18} />
                    Importar {data.length} registros
                  </>
                )}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-semibold">
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
