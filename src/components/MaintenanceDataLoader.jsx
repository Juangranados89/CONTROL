import { useState, useMemo } from 'react';
import { Upload, Database, CheckCircle2, AlertCircle, FileSpreadsheet, X, Loader2, Eye } from 'lucide-react';

export default function MaintenanceDataLoader({ fleet, setFleet, setVariableHistory, onClose }) {
  const [rawData, setRawData] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationResults, setValidationResults] = useState(null);

  // Función inteligente para detectar separador
  const detectSeparator = (text) => {
    const firstLine = text.split('\n')[0];
    const separators = ['\t', '|', ';', ','];
    
    // Contar ocurrencias de cada separador
    const counts = separators.map(sep => ({
      separator: sep,
      count: (firstLine.match(new RegExp(`\\${sep}`, 'g')) || []).length
    }));
    
    // Ordenar por mayor cantidad
    counts.sort((a, b) => b.count - a.count);
    
    // Si el mejor tiene al menos 5 separadores, usarlo
    if (counts[0].count >= 5) {
      return counts[0].separator;
    }
    
    // Si no hay suficientes separadores explícitos, buscar múltiples espacios
    if (/\s{2,}/.test(firstLine)) {
      return /\s{2,}/; // Regex para múltiples espacios
    }
    
    // Por defecto: tab
    return '\t';
  };

  // Función para limpiar y normalizar valores
  const cleanValue = (val) => {
    if (!val) return '';
    return val.trim().replace(/^["']|["']$/g, ''); // Remover comillas
  };

  // Función para parsear números (km, frecuencia, etc)
  const parseNumber = (val) => {
    if (!val || val === '#N/D' || val === 'N/A' || val === '-') return 0;
    const cleaned = val.replace(/[,.\s]/g, '');
    return parseInt(cleaned) || 0;
  };

  // Función para parsear fechas (DD/MM/YYYY o DD-MM-YYYY o YYYY-MM-DD)
  const parseDate = (val) => {
    if (!val || val === '#N/D' || val === 'N/A' || val === '-') return null;
    
    const cleaned = cleanValue(val);
    
    // Intentar DD/MM/YYYY o DD-MM-YYYY
    let parts = cleaned.split(/[\/\-]/);
    if (parts.length === 3) {
      const [first, second, third] = parts;
      
      // Si el tercero es año (4 dígitos)
      if (third.length === 4) {
        return `${first.padStart(2, '0')}/${second.padStart(2, '0')}/${third}`;
      }
      // Si el primero es año (YYYY-MM-DD)
      if (first.length === 4) {
        return `${third.padStart(2, '0')}/${second.padStart(2, '0')}/${first}`;
      }
    }
    
    return cleaned;
  };

  // Función principal de parsing
  const parseData = () => {
    if (!rawData.trim()) {
      alert('❌ Por favor pegue los datos antes de analizar');
      return;
    }

    setIsProcessing(true);

    try {
      const lines = rawData.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        alert('❌ No se encontraron datos válidos');
        setIsProcessing(false);
        return;
      }

      const separator = detectSeparator(rawData);
      console.log('🔍 Separador detectado:', separator);

      const rows = lines.map(line => {
        if (separator instanceof RegExp) {
          // Múltiples espacios
          return line.split(separator).filter(cell => cell.trim());
        } else {
          return line.split(separator);
        }
      });

      // Detectar encabezados (primera fila)
      let dataStartIndex = 0;
      const firstRow = rows[0].map(cell => cleanValue(cell).toUpperCase());
      
      if (firstRow.some(cell => 
        cell.includes('INTERNO') || 
        cell.includes('PLACA') || 
        cell.includes('CODIGO') ||
        cell.includes('DESCRIPCION')
      )) {
        dataStartIndex = 1;
        console.log('✅ Encabezados detectados en fila 0');
      }

      // Procesar datos
      const parsed = [];
      const errors = [];

      for (let i = dataStartIndex; i < rows.length; i++) {
        const cols = rows[i];
        
        // Validar cantidad mínima de columnas
        if (cols.length < 8) {
          errors.push({
            row: i + 1,
            message: `Solo ${cols.length} columnas (se requieren al menos 8)`,
            data: cols.slice(0, 3).join(' | ')
          });
          continue;
        }

        // Mapeo flexible de columnas
        // Formato esperado: #INTERNO | PLACA | DESCRIPCION | FRECUENCIA | CLASE | MARCA | UBICACION | DILER | FECHA_VAR | VAR_ACTUAL | ULTIMO_MTTO | FECHA_ULTIMO
        const record = {
          code: cleanValue(cols[0]),
          plate: cleanValue(cols[1]),
          description: cleanValue(cols[2]) || '',
          frequency: parseNumber(cols[3]) || 5000,
          class: cleanValue(cols[4]) || 'KM',
          brand: cleanValue(cols[5]) || '',
          location: cleanValue(cols[6]) || '',
          dealer: cols[7] ? cleanValue(cols[7]) : '',
          variableDate: cols[8] ? parseDate(cols[8]) : null,
          currentMileage: cols[9] ? parseNumber(cols[9]) : 0,
          lastMaintenanceMileage: cols[10] ? parseNumber(cols[10]) : 0,
          lastMaintenanceDate: cols[11] ? parseDate(cols[11]) : null,
          rawRow: i + 1
        };

        // Validaciones básicas
        if (!record.code && !record.plate) {
          errors.push({
            row: i + 1,
            message: 'Falta código interno y placa',
            data: cols.slice(0, 3).join(' | ')
          });
          continue;
        }

        // Buscar vehículo en flota
        const vehicleMatch = fleet.find(v => 
          (record.code && v.code === record.code) || 
          (record.plate && v.plate === record.plate)
        );

        record.matched = !!vehicleMatch;
        record.matchedVehicle = vehicleMatch;

        parsed.push(record);
      }

      setParsedData(parsed);
      setValidationResults({
        total: rows.length - dataStartIndex,
        matched: parsed.filter(r => r.matched).length,
        unmatched: parsed.filter(r => !r.matched).length,
        errors: errors.length,
        errorDetails: errors
      });

      setShowPreview(true);
      setIsProcessing(false);

      console.log('✅ Parsing completado:', {
        total: parsed.length,
        matched: parsed.filter(r => r.matched).length,
        errors: errors.length
      });

    } catch (error) {
      console.error('❌ Error al parsear datos:', error);
      alert(`Error al procesar los datos: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // Función para aplicar los cambios
  const applyChanges = () => {
    if (parsedData.length === 0) {
      alert('❌ No hay datos para aplicar');
      return;
    }

    setIsProcessing(true);

    try {
      const newFleet = [...fleet];
      const historyEntries = [];
      let updatedCount = 0;

      parsedData.forEach(record => {
        if (!record.matched || !record.matchedVehicle) return;

        const vehicleIndex = newFleet.findIndex(v => 
          v.code === record.matchedVehicle.code || 
          v.plate === record.matchedVehicle.plate
        );

        if (vehicleIndex === -1) return;

        const vehicle = newFleet[vehicleIndex];
        const oldMileage = vehicle.currentKm || 0;

        // Actualizar datos del vehículo
        newFleet[vehicleIndex] = {
          ...vehicle,
          currentKm: record.currentMileage,
          lastMaintenanceKm: record.lastMaintenanceMileage,
          lastMaintenanceDate: record.lastMaintenanceDate,
          frequency: record.frequency,
          lastUpdate: new Date().toISOString().split('T')[0],
          nextMaintenanceKm: record.lastMaintenanceMileage + record.frequency
        };

        // Solo registrar en historial si el kilometraje cambió
        if (record.currentMileage !== oldMileage) {
          historyEntries.push({
            id: Date.now() + Math.random(),
            date: new Date().toISOString().split('T')[0],
            vehiclePlate: vehicle.plate,
            vehicleCode: vehicle.code,
            mileage: record.currentMileage,
            change: record.currentMileage - oldMileage,
            updatedBy: 'Carga Masiva',
            uploadDate: new Date().toISOString()
          });
        }

        updatedCount++;
      });

      // Guardar en estado y localStorage
      setFleet(newFleet);
      localStorage.setItem('fleet', JSON.stringify(newFleet));

      if (historyEntries.length > 0) {
        setVariableHistory(prev => {
          const updated = [...prev, ...historyEntries];
          localStorage.setItem('variable_history', JSON.stringify(updated));
          return updated;
        });
      }

      alert(`✅ Actualización completada exitosamente\n\n` +
        `📊 Vehículos actualizados: ${updatedCount}\n` +
        `📈 Registros en historial: ${historyEntries.length}\n` +
        `⚠️ No encontrados: ${parsedData.filter(r => !r.matched).length}`
      );

      setIsProcessing(false);
      onClose();

    } catch (error) {
      console.error('❌ Error al aplicar cambios:', error);
      alert(`Error al guardar los cambios: ${error.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <Database className="text-blue-600" size={28} />
              Carga Masiva de Mantenimiento
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Sistema inteligente de importación con detección automática de formato
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <X size={24} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!showPreview ? (
            // Vista de carga
            <div className="space-y-4">
              {/* Instrucciones */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="text-blue-600" size={20} />
                  📋 Formatos Soportados
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-white rounded p-3 border border-blue-100">
                    <p className="font-semibold text-blue-900 mb-1">✅ Separadores detectados automáticamente:</p>
                    <ul className="text-slate-600 text-xs space-y-1 ml-4">
                      <li>• Tabulaciones (Excel/Google Sheets)</li>
                      <li>• Punto y coma (;)</li>
                      <li>• Pipe (|)</li>
                      <li>• Comas (CSV)</li>
                      <li>• Múltiples espacios</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded p-3 border border-blue-100">
                    <p className="font-semibold text-green-900 mb-1">✅ Datos reconocidos:</p>
                    <ul className="text-slate-600 text-xs space-y-1 ml-4">
                      <li>• Fechas: DD/MM/YYYY, DD-MM-YYYY</li>
                      <li>• Números con comas, puntos, espacios</li>
                      <li>• Valores vacíos: #N/D, N/A, -</li>
                      <li>• Encabezados automáticos</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Formato esperado */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-bold text-slate-700 mb-2 text-sm">📊 Columnas esperadas (mínimo 8):</h4>
                <div className="bg-white p-3 rounded border border-slate-200 overflow-x-auto">
                  <code className="text-xs text-slate-700 whitespace-nowrap block">
                    #INTERNO | PLACA | DESCRIPCION | FRECUENCIA | CLASE | MARCA | UBICACION | DILER | FECHA_VAR | VAR_ACTUAL | ULTIMO_MTTO | FECHA_ULTIMO
                  </code>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  <strong>Nota:</strong> Las columnas DILER, FECHA_VAR, VAR_ACTUAL, ULTIMO_MTTO y FECHA_ULTIMO son opcionales.
                </p>
              </div>

              {/* Textarea para pegar datos */}
              <div>
                <label className="block font-semibold text-slate-700 mb-2">
                  📝 Pegue los datos aquí (Ctrl+V):
                </label>
                <textarea
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                  placeholder="Pegue aquí los datos copiados desde Excel, Google Sheets, CSV, o cualquier formato separado por tabulaciones, punto y coma, comas, etc..."
                  className="w-full h-80 p-4 border-2 border-slate-300 rounded-lg font-mono text-xs resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none bg-slate-50"
                  disabled={isProcessing}
                />
                <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                  <span>{rawData.split('\n').filter(l => l.trim()).length} líneas</span>
                  <button
                    onClick={() => setRawData('')}
                    className="text-red-600 hover:text-red-700 font-medium"
                    disabled={isProcessing}
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Botón para analizar */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
                <button
                  onClick={parseData}
                  disabled={!rawData.trim() || isProcessing}
                  className={`px-8 py-3 rounded-lg font-bold transition-all flex items-center gap-2 ${
                    !rawData.trim() || isProcessing
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Eye size={20} />
                      Analizar y Vista Previa
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Vista de preview
            <div className="space-y-4">
              {/* Resumen de validación */}
              {validationResults && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <div className="text-3xl font-bold text-blue-700">{validationResults.total}</div>
                    <div className="text-sm text-blue-900 font-medium">Registros Totales</div>
                  </div>
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <div className="text-3xl font-bold text-green-700">{validationResults.matched}</div>
                    <div className="text-sm text-green-900 font-medium">✅ Coinciden</div>
                  </div>
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                    <div className="text-3xl font-bold text-yellow-700">{validationResults.unmatched}</div>
                    <div className="text-sm text-yellow-900 font-medium">⚠️ No Encontrados</div>
                  </div>
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <div className="text-3xl font-bold text-red-700">{validationResults.errors}</div>
                    <div className="text-sm text-red-900 font-medium">❌ Errores</div>
                  </div>
                </div>
              )}

              {/* Errores */}
              {validationResults?.errorDetails.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                    <AlertCircle size={18} />
                    Errores encontrados:
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {validationResults.errorDetails.slice(0, 10).map((err, idx) => (
                      <div key={idx} className="text-xs text-red-800 bg-white rounded p-2">
                        <strong>Fila {err.row}:</strong> {err.message} - {err.data}
                      </div>
                    ))}
                    {validationResults.errorDetails.length > 10 && (
                      <p className="text-xs text-red-700 italic">
                        ... y {validationResults.errorDetails.length - 10} errores más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tabla de preview */}
              <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                  <h3 className="font-bold text-slate-800">Vista Previa de Datos</h3>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Estado</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Código</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Placa</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Frecuencia</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Variable Actual</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Último Mtto</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Fecha Último</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((record, idx) => (
                        <tr 
                          key={idx} 
                          className={`border-b border-slate-100 ${
                            record.matched 
                              ? 'bg-green-50 hover:bg-green-100' 
                              : 'bg-yellow-50 hover:bg-yellow-100'
                          }`}
                        >
                          <td className="px-3 py-2">
                            {record.matched ? (
                              <CheckCircle2 size={16} className="text-green-600" />
                            ) : (
                              <AlertCircle size={16} className="text-yellow-600" />
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono">{record.code}</td>
                          <td className="px-3 py-2 font-semibold">{record.plate}</td>
                          <td className="px-3 py-2">{record.frequency.toLocaleString()}</td>
                          <td className="px-3 py-2">{record.currentMileage.toLocaleString()}</td>
                          <td className="px-3 py-2">{record.lastMaintenanceMileage.toLocaleString()}</td>
                          <td className="px-3 py-2">{record.lastMaintenanceDate || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-between gap-3">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setParsedData([]);
                    setValidationResults(null);
                  }}
                  className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                  disabled={isProcessing}
                >
                  ← Volver a Editar
                </button>
                <button
                  onClick={applyChanges}
                  disabled={parsedData.filter(r => r.matched).length === 0 || isProcessing}
                  className={`px-8 py-3 rounded-lg font-bold transition-all flex items-center gap-2 ${
                    parsedData.filter(r => r.matched).length === 0 || isProcessing
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      Aplicar Cambios ({parsedData.filter(r => r.matched).length})
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
