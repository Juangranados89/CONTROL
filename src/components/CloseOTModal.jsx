import { useState } from 'react';
import { X, CheckCircle, FileCheck, Calendar, Gauge } from 'lucide-react';
import SignatureCanvas from './SignatureCanvas';

export default function CloseOTModal({ workOrder, currentUser, onClose, onSave }) {
  const [responsibleSignature, setResponsibleSignature] = useState(null);
  const [receivedSignature, setReceivedSignature] = useState(null);
  const [showResponsibleCanvas, setShowResponsibleCanvas] = useState(false);
  const [showReceivedCanvas, setShowReceivedCanvas] = useState(false);
  
  // Campos obligatorios: fecha y km de ejecución
  const [executionDate, setExecutionDate] = useState(new Date().toISOString().split('T')[0]);
  const [executionKm, setExecutionKm] = useState('');

  const handleSaveClose = () => {
    // Validar campos obligatorios
    if (!executionDate) {
      alert('⚠️ Debe ingresar la FECHA DE EJECUCIÓN');
      return;
    }
    if (!executionKm || executionKm.trim() === '' || parseInt(executionKm) <= 0) {
      alert('⚠️ Debe ingresar el KILOMETRAJE DE EJECUCIÓN válido');
      return;
    }
    if (!responsibleSignature) {
      alert('⚠️ Falta la firma del RESPONSABLE');
      return;
    }
    if (!receivedSignature) {
      alert('⚠️ Falta la firma de RECIBE A SATISFACCIÓN');
      return;
    }

    const closedOT = {
      ...workOrder,
      status: 'CERRADA',
      closedDate: executionDate,
      closedTime: new Date().toLocaleTimeString('es-ES'),
      executionKm: parseInt(executionKm),
      signatures: {
        responsible: responsibleSignature,
        approver: currentUser?.name || currentUser?.username || 'Sistema',
        received: receivedSignature
      }
    };

    onSave(closedOT);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-4 sm:p-6 border-b-2 border-blue-900 bg-white">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
                <FileCheck className="text-blue-900" size={24} />
                Cerrar Orden de Trabajo
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                OT #{workOrder.id} - {workOrder.plate} - {workOrder.vehicleCode || workOrder.code}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={24} className="text-slate-400 hover:text-slate-700" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-6">
              {/* Main form */}
              <div className="space-y-5">
                {/* Información de la OT */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-bold text-slate-800">Detalles</h3>
                    <div className="text-xs text-slate-500">
                      {workOrder.creationDate}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-3">
                    <div>
                      <span className="text-slate-600">Placa:</span>
                      <span className="ml-2 font-semibold">{workOrder.plate}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Código:</span>
                      <span className="ml-2 font-semibold">{workOrder.vehicleCode || workOrder.code}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-600">Taller:</span>
                      <span className="ml-2 font-semibold">{workOrder.workshop}</span>
                    </div>
                  </div>
                </div>

                {/* Datos de Ejecución (Obligatorios) */}
                <div className="border border-slate-200 rounded-lg p-4 bg-white">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle className="text-blue-900" size={18} />
                    Ejecución
                    <span className="text-slate-500 text-sm font-medium">(Requerido)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={executionDate}
                        onChange={(e) => setExecutionDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">
                        Kilometraje
                      </label>
                      <input
                        type="number"
                        value={executionKm}
                        onChange={(e) => setExecutionKm(e.target.value)}
                        placeholder="Ej: 45000"
                        min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Firmas */}
                <div className="border border-slate-200 rounded-lg p-4 bg-white">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="text-blue-900" size={18} />
                    Firmas
                    <span className="text-slate-500 text-sm font-medium">(Requerido)</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-500">RESPONSABLE</div>
                          <div className={`text-xs mt-1 ${responsibleSignature ? 'text-green-700' : 'text-slate-500'}`}>
                            {responsibleSignature ? 'Firmado' : 'Pendiente'}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowResponsibleCanvas(true)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            responsibleSignature
                              ? 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                              : 'bg-blue-900 text-white hover:bg-blue-800'
                          }`}
                        >
                          Firmar
                        </button>
                      </div>
                      {responsibleSignature && (
                        typeof responsibleSignature === 'string' ? (
                          <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3">
                            <img src={responsibleSignature} alt="Firma Responsable" className="max-h-20 mx-auto" />
                          </div>
                        ) : (
                          <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3 text-center">
                            <div className="text-sm font-bold text-slate-800">{responsibleSignature.name}</div>
                            <div className="text-xs text-slate-500 mb-2">{responsibleSignature.position}</div>
                            <img src={responsibleSignature.image} alt="Firma Responsable" className="max-h-16 mx-auto" />
                          </div>
                        )
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-500">RECIBE A SATISFACCIÓN</div>
                          <div className={`text-xs mt-1 ${receivedSignature ? 'text-green-700' : 'text-slate-500'}`}>
                            {receivedSignature ? 'Firmado' : 'Pendiente'}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowReceivedCanvas(true)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            receivedSignature
                              ? 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                              : 'bg-blue-900 text-white hover:bg-blue-800'
                          }`}
                        >
                          Firmar
                        </button>
                      </div>
                      {receivedSignature && (
                        typeof receivedSignature === 'string' ? (
                          <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3">
                            <img src={receivedSignature} alt="Firma Recibe" className="max-h-20 mx-auto" />
                          </div>
                        ) : (
                          <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3 text-center">
                            <div className="text-sm font-bold text-slate-800">{receivedSignature.name}</div>
                            <div className="text-xs text-slate-500 mb-2">{receivedSignature.position}</div>
                            <img src={receivedSignature.image} alt="Firma Recibe" className="max-h-16 mx-auto" />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Side panel */}
              <aside className="lg:sticky lg:top-0 lg:self-start">
                <div className="border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Resumen</h3>
                    <span className="text-xs text-slate-500">Requeridos</span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Fecha</span>
                      <span className={executionDate ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                        {executionDate ? 'OK' : 'Falta'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Kilometraje</span>
                      <span className={executionKm ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                        {executionKm ? 'OK' : 'Falta'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Firma responsable</span>
                      <span className={responsibleSignature ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                        {responsibleSignature ? 'OK' : 'Falta'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Firma recibe</span>
                      <span className={receivedSignature ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                        {receivedSignature ? 'OK' : 'Falta'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="text-xs font-semibold text-slate-500">APROBADOR</div>
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <div className="font-semibold text-slate-900">
                        {currentUser?.name || currentUser?.username || 'Sistema'}
                      </div>
                      <div className="text-[11px] text-slate-500">Usuario actual</div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      onClick={handleSaveClose}
                      disabled={!executionDate || !executionKm || !responsibleSignature || !receivedSignature}
                      className={`w-full py-2.5 px-4 rounded-lg font-bold transition-colors ${
                        !executionDate || !executionKm || !responsibleSignature || !receivedSignature
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-900 text-white hover:bg-blue-800'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle size={18} />
                        Cerrar OT
                      </div>
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full py-2.5 px-4 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>

                  {(!executionDate || !executionKm || !responsibleSignature || !receivedSignature) && (
                    <p className="text-xs text-slate-500 mt-3">
                      Completa los requeridos para cerrar la OT.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 p-4 sm:p-6 bg-white lg:hidden">
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
              <button
                onClick={onClose}
                className="w-full sm:w-auto sm:min-w-32 py-2.5 px-4 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveClose}
                disabled={!executionDate || !executionKm || !responsibleSignature || !receivedSignature}
                className={`w-full sm:w-auto sm:min-w-40 py-2.5 px-5 rounded-lg font-bold transition-colors ${
                  !executionDate || !executionKm || !responsibleSignature || !receivedSignature
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-900 text-white hover:bg-blue-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle size={18} />
                  Cerrar OT
                </div>
              </button>
            </div>
            {(!executionDate || !executionKm || !responsibleSignature || !receivedSignature) && (
              <p className="text-xs text-slate-500 mt-3 text-center">
                Complete todos los campos requeridos para cerrar la orden
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modals de Firma */}
      {showResponsibleCanvas && (
        <SignatureCanvas
          label="Firma del RESPONSABLE"
          initialSignature={responsibleSignature}
          onSave={(signature) => {
            setResponsibleSignature(signature);
            setShowResponsibleCanvas(false);
          }}
          onCancel={() => setShowResponsibleCanvas(false)}
        />
      )}

      {showReceivedCanvas && (
        <SignatureCanvas
          label="Firma RECIBE A SATISFACCIÓN"
          initialSignature={receivedSignature}
          onSave={(signature) => {
            setReceivedSignature(signature);
            setShowReceivedCanvas(false);
          }}
          onCancel={() => setShowReceivedCanvas(false)}
        />
      )}
    </>
  );
}
