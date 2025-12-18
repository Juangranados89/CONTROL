import { useState } from 'react';
import { X, CheckCircle, FileCheck } from 'lucide-react';
import SignatureCanvas from './SignatureCanvas';

export default function CloseOTModal({ workOrder, currentUser, onClose, onSave }) {
  const [responsibleSignature, setResponsibleSignature] = useState(null);
  const [receivedSignature, setReceivedSignature] = useState(null);
  const [showResponsibleCanvas, setShowResponsibleCanvas] = useState(false);
  const [showReceivedCanvas, setShowReceivedCanvas] = useState(false);

  const handleSaveClose = () => {
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
      closedDate: new Date().toISOString().split('T')[0],
      closedTime: new Date().toLocaleTimeString('es-ES'),
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
          <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <FileCheck className="text-green-600" size={28} />
                Cerrar Orden de Trabajo
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                OT #{workOrder.id} - {workOrder.plate} - {workOrder.code}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <X size={24} className="text-slate-400 hover:text-slate-600" />
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
                  <span className="ml-2 font-semibold">{workOrder.code}</span>
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

            {/* Firmas */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle className="text-green-600" size={20} />
                Firmas Requeridas
              </h3>

              {/* RESPONSABLE */}
              <div className="border-2 border-slate-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="font-semibold text-slate-700">
                    RESPONSABLE
                  </label>
                  <button
                    onClick={() => setShowResponsibleCanvas(true)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      responsibleSignature
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {responsibleSignature ? '✓ Firma Capturada - Editar' : '✍️ Firmar'}
                  </button>
                </div>
                {responsibleSignature && (
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <img
                      src={responsibleSignature}
                      alt="Firma Responsable"
                      className="max-h-24 mx-auto"
                    />
                  </div>
                )}
              </div>

              {/* APROBADOR (Auto-llenado) */}
              <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                <label className="font-semibold text-slate-700 block mb-2">
                  APROBADOR
                </label>
                <div className="bg-white border border-green-300 rounded px-4 py-3">
                  <p className="font-bold text-green-700 text-lg">
                    {currentUser?.name || currentUser?.username || 'Sistema'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Usuario actual en sesión - Se registra automáticamente
                  </p>
                </div>
              </div>

              {/* RECIBE A SATISFACCIÓN */}
              <div className="border-2 border-slate-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="font-semibold text-slate-700">
                    RECIBE A SATISFACCIÓN
                  </label>
                  <button
                    onClick={() => setShowReceivedCanvas(true)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      receivedSignature
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {receivedSignature ? '✓ Firma Capturada - Editar' : '✍️ Firmar'}
                  </button>
                </div>
                {receivedSignature && (
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
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
          <div className="border-t border-slate-200 p-6 bg-slate-50">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveClose}
                disabled={!responsibleSignature || !receivedSignature}
                className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors ${
                  !responsibleSignature || !receivedSignature
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle size={20} />
                  Cerrar OT
                </div>
              </button>
            </div>
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
