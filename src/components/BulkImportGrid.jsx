import React, { useState } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { useDialog } from './DialogProvider.jsx';

export default function BulkImportGrid({ onClose, onConfirmImport }) {
  const dialog = useDialog();
  const [pastedData, setPastedData] = useState([]);
  const [parsedVehicles, setParsedVehicles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  const headers = [
    'CODIGO DEL EQUIPO',
    'FAMILIA/TIPOLOGÍA',
    'DESCRIPCIÓN',
    'PLACA',
    'MARCA',
    'MODELO / LINEA',
    'SERIE CHASIS / VIN',
    'SERIE MOTOR',
    'AÑO MODELO',
    'ESTADO ACTUAL',
    'UBICACIÓN O FRENTE'
  ];

  const parsePastedData = (text) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const errors = [];
    
    // Detectar y omitir encabezados
    const headerKeywords = ['codigo', 'placa', 'modelo', 'familia', 'descripcion', 'marca', 'serie', 'año', 'estado', 'ubicacion'];
    const filteredLines = lines.filter((line, idx) => {
      const lowerLine = line.toLowerCase();
      // Si es la primera línea y contiene 3+ keywords de encabezado, omitir
      if (idx === 0) {
        const matchCount = headerKeywords.filter(kw => lowerLine.includes(kw)).length;
        if (matchCount >= 3) {
          return false; // Es encabezado, omitir
        }
      }
      return true;
    });
    
    const parsed = filteredLines.map(line => {
      // Intentar múltiples delimitadores: tab, punto y coma, doble espacio
      let cols = line.split('\t');
      if (cols.length < 5) cols = line.split(';');
      if (cols.length < 5) cols = line.split(/\s{2,}/);
      
      // Asegurar 11 columnas
      while (cols.length < 11) cols.push('');
      return cols.slice(0, 11).map(col => col.trim());
    });
    
    const vehicles = parsed.map((row, idx) => {
      const vehicle = {
        id: Date.now() + idx,
        code: row[0] || `PVHC${String(idx + 1).padStart(3, '0')}`,
        familiaTipologia: row[1] || 'CAMIONETA',
        descripcion: row[2] || '',
        plate: row[3] || '5000',
        brand: row[4] || 'TOYOTA',
        model: row[5] || '',
        serieChasis: row[6] || '',
        vin: row[6] || '',
        serieMotor: row[7] || '',
        anioModelo: row[8] || '',
        year: row[8] || new Date().getFullYear(),
        estadoActual: row[9] || 'OPERATIVO',
        status: row[9] || 'OPERATIVO',
        ubicacionFrente: row[10] || '',
        area: row[10] || '',
        driver: 'PENDIENTE',
        assignedRoutine: '',
        owner: 'PROPIO',
        mileage: 0,
        lastMaintenance: 0,
        lastMaintenanceDate: null
      };
      
      // Validaciones
      if (!row[0]) errors.push(`Fila ${idx + 1}: Falta código de equipo`);
      if (!row[3]) errors.push(`Fila ${idx + 1}: Falta placa`);
      if (!row[1] || !row[1].toUpperCase().includes('CAMIONETA')) {
        errors.push(`Fila ${idx + 1}: No es CAMIONETA (${row[1] || 'vacío'})`);
      }
      
      return vehicle;
    });
    
    setValidationErrors(errors);
    return { raw: parsed, vehicles };
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (text.trim()) {
      const { raw, vehicles } = parsePastedData(text);
      setPastedData(raw);
      setParsedVehicles(vehicles);
    }
  };

  const handleClear = () => {
    setPastedData([]);
    setParsedVehicles([]);
    setValidationErrors([]);
  };

  const handleConfirmImport = async () => {
    if (parsedVehicles.length === 0) return;
    
    setImporting(true);
    try {
      await onConfirmImport(parsedVehicles);
      onClose();
    } catch (error) {
      console.error('Error al importar:', error);
      await dialog.alert({ title: 'Error', message: 'Error al importar los datos. Revise la consola.', variant: 'danger' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Importación Masiva de Activos</h2>
              <p className="text-xs text-gray-600 mt-1">Pegue datos de Excel (Ctrl+V) con las 11 columnas requeridas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {pastedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div 
                className="w-full max-w-4xl border-4 border-dashed border-blue-300 rounded-lg p-12 text-center bg-blue-50 cursor-text"
                onPaste={handlePaste}
                tabIndex={0}
              >
                <Upload className="h-16 w-16 text-blue-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Presione Ctrl+V para pegar datos
                </h3>
                <p className="text-gray-600 mb-6">
                  Copie las filas desde Excel y péguelas aquí
                </p>
              </div>

              <div className="mt-8 bg-white p-6 rounded-lg shadow-lg max-w-4xl">
                <p className="text-sm text-gray-700 mb-4">
                  <strong>Formato esperado:</strong> 11 columnas separadas por tabs, punto y coma (;) o dobles espacios
                </p>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-xs overflow-x-auto">
                  <div className="whitespace-nowrap">PVHC001	CAMIONETA	TOYOTA HILUX 4X4	ABC123	TOYOTA	HILUX	VIN123456	MOT789	2023	OPERATIVO	OBRA NORTE</div>
                  <div className="whitespace-nowrap">PVHC002	CAMIONETA	NISSAN FRONTIER 4X4	DEF456	NISSAN	FRONTIER	VIN234567	MOT890	2022	OPERATIVO	OBRA SUR</div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  <strong>Orden:</strong> Código | Familia/Tipología | Descripción | Placa | Marca | Modelo/Línea | Serie Chasis/VIN | Serie Motor | Año Modelo | Estado Actual | Ubicación
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  ⚠ Solo se importarán vehículos que sean <strong>CAMIONETAS</strong> y <strong>PROPIOS</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {validationErrors.length > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-amber-400 mr-2 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-medium text-amber-800 mb-2">Advertencias de validación:</h3>
                      <ul className="text-xs text-amber-700 space-y-1">
                        {validationErrors.slice(0, 10).map((err, idx) => (
                          <li key={idx}>• {err}</li>
                        ))}
                        {validationErrors.length > 10 && (
                          <li className="font-semibold">... y {validationErrors.length - 10} advertencias más</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        {headers.map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pastedData.map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-gray-50 px-6 py-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">{parsedVehicles.length}</span> vehículos listos para importar
                      {validationErrors.length > 0 && (
                        <span className="text-amber-600 ml-3">
                          ({validationErrors.length} advertencias)
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleClear}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Limpiar
                      </button>
                      <button
                        onClick={handleConfirmImport}
                        disabled={importing || parsedVehicles.length === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {importing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Importando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Confirmar Importación
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
