import { useState, useRef, useEffect } from 'react';
import { X, Eraser, Check, Edit3 } from 'lucide-react';

export default function SignatureCanvas({ label, onSave, onCancel, initialSignature = null }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureMode, setSignatureMode] = useState('draw'); // 'draw' or 'type'
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Si hay firma inicial, cargarla
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    ctx.lineTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.closePath();
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTypedText('');
  };

  const handleTypedSignature = () => {
    if (!typedText.trim()) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Configurar estilo de texto
    ctx.font = 'italic 32px "Brush Script MT", cursive';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Dibujar texto centrado
    ctx.fillText(typedText, canvas.width / 2, canvas.height / 2);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    onSave(dataURL);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Edit3 className="text-blue-600" size={20} />
            {label}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-white rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setSignatureMode('draw')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              signatureMode === 'draw'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ✍️ Dibujar Firma
          </button>
          <button
            onClick={() => setSignatureMode('type')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              signatureMode === 'type'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ⌨️ Escribir Nombre
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {signatureMode === 'draw' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 text-center">
                Dibuje su firma usando el mouse o toque la pantalla si está en dispositivo táctil
              </p>
              
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="border-2 border-slate-300 rounded-lg cursor-crosshair w-full bg-white"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                  });
                  canvasRef.current.dispatchEvent(mouseEvent);
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                  });
                  canvasRef.current.dispatchEvent(mouseEvent);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  const mouseEvent = new MouseEvent('mouseup', {});
                  canvasRef.current.dispatchEvent(mouseEvent);
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 text-center">
                Escriba su nombre completo y se generará una firma en estilo manuscrito
              </p>
              
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                onBlur={handleTypedSignature}
                placeholder="Ej: Juan Granados"
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
              />
              
              <div className="border-2 border-slate-300 rounded-lg p-4 bg-white min-h-[200px] flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full"
                />
              </div>
              
              <button
                onClick={handleTypedSignature}
                className="w-full py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
              >
                Generar Firma
              </button>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={clearCanvas}
              className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Eraser size={18} />
              Limpiar
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors font-bold flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Guardar Firma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
