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
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-300">
          <h3 className="text-base font-semibold text-slate-900">{label}</h3>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Input nombre */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">Escribir nombre:</label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => {
                setTypedText(e.target.value);
                if (e.target.value.trim()) {
                  setTimeout(() => handleTypedSignature(), 100);
                }
              }}
              placeholder="Ej: Juan Granados"
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-900"
            />
          </div>

          {/* Canvas */}
          <div className="border border-slate-300 rounded bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              className="w-full cursor-crosshair"
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

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={clearCanvas}
              className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-100"
            >
              Limpiar
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-3 py-1.5 text-sm bg-blue-900 text-white rounded hover:bg-blue-800 font-medium"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
