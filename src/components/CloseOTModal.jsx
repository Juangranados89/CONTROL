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
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b-2 border-blue-900 bg-white">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <FileCheck className="text-blue-900" size={28} />
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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Información de la OT */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="font-bold text-slate-700 mb-2">Detalles de la Orden</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-600">Placa:</span>
                  <span className="ml-2 font-semibold">{workOrder.plate}</span>
                </div>
                <div>
                  <span className="text-slate-600">Código:</span>
                  <span className="ml-2 font-semibold">{workOrder.vehicleCode || workOrder.code}</span>
                </div>
                <div>
                  <span className="text-slate-600">Taller:</span>
                  <span className="ml-2 font-semibold">{workOrder.workshop}</span>
                </div>
                <div>
                  <span className="text-slate-600">Creación:</span>
                  <span className="ml-2 font-semibold">{workOrder.creationDate}</span>
                </div>
              </div>
            </div>

            {/* Datos de Ejecución (Obligatorios) */}
            <div className="border border-slate-300 rounded-lg p-4 bg-white">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircle className="text-blue-900" size={20} />
                Datos de Ejecución <span className="text-slate-500 text-sm">(Requerido)</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <Calendar className="text-blue-900" size={16} />
                    Fecha de Ejecución
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
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <Gauge className="text-blue-900" size={16} />
                    Kilometraje de Ejecución
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
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="text-blue-900" size={20} />
                Firmas Requeridas <span className="text-slate-500 text-sm">(Requerido)</span>
              </h3>

              {/* RESPONSABLE */}
              <div className="border border-slate-300 rounded-lg p-4 bg-white">
                <div className="flex justify-between items-center mb-3">
                  <label className="font-semibold text-slate-900">
                    RESPONSABLE
                  </label>
                  <button
                    onClick={() => setShowResponsibleCanvas(true)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      responsibleSignature
                        ? 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                        : 'bg-blue-900 text-white hover:bg-blue-800'
                    }`}
                  >
                    {responsibleSignature ? '✓ Firmado' : '✍️ Firmar'}
                  </button>
                </div>
                {responsibleSignature && (
                  <div className="bg-slate-50 border border-slate-300 rounded p-3">
                    <img
                      src={responsibleSignature}
                      alt="Firma Responsable"
                      className="max-h-24 mx-auto"
                    />
                  </div>
                )}
              </div>

              {/* APROBADOR (Auto-llenado) */}
              <div className="border border-slate-300 bg-slate-50 rounded-lg p-4">
                <label className="font-semibold text-slate-900 block mb-2 flex items-center gap-2">
                  <CheckCircle className="text-blue-900" size={18} />
                  APROBADOR
                </label>
                <div className="bg-white border border-slate-300 rounded px-4 py-3">
                  <p className="font-bold text-slate-900 text-lg">
                    {currentUser?.name || currentUser?.username || 'Sistema'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Usuario actual - Se registra automáticamente
                  </p>
                </div>
              </div>

              {/* RECIBE A SATISFACCIÓN */}
              <div className="border border-slate-300 rounded-lg p-4 bg-white">
                <div className="flex justify-between items-center mb-3">
                  <label className="font-semibold text-slate-900">
                    RECIBE A SATISFACCIÓN
                  </label>
                  <button
                    onClick={() => setShowReceivedCanvas(true)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      receivedSignature
                        ? 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                        : 'bg-blue-900 text-white hover:bg-blue-800'
                    }`}
                  >
                    {receivedSignature ? '✓ Firmado' : '✍️ Firmar'}
                  </button>
                </div>
                {receivedSignature && (
                  <div className="bg-slate-50 border border-slate-300 rounded p-3">
                    <img
                      src={receivedSignature}
                      alt="Firma Recibe"
                      className="max-h-24 mx-auto"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 p-6 bg-white">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveClose}
                disabled={!executionDate || !executionKm || !responsibleSignature || !receivedSignature}
                className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors ${
                  !executionDate || !executionKm || !responsibleSignature || !receivedSignature
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-900 text-white hover:bg-blue-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle size={20} />
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
