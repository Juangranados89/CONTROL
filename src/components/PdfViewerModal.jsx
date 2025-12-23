import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function PdfViewerModal({ open, title, url, filename, onClose }) {
  const [zoom, setZoom] = useState(110);

  useEffect(() => {
    if (!open) return;
    setZoom(110);
  }, [open, url]);

  const iframeSrc = useMemo(() => {
    if (!url) return '';
    return `${url}#zoom=${zoom}`;
  }, [url, zoom]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="bg-slate-800 px-5 py-3 flex items-center justify-between text-white">
          <div className="min-w-0">
            <h3 className="text-base font-bold truncate">{title || 'Vista previa de PDF'}</h3>
            {filename ? <p className="text-[11px] text-slate-300 truncate">{filename}</p> : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => clamp(z - 10, 50, 200))}
              className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
              title="Alejar"
            >
              <ZoomOut size={16} />
              {zoom}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => clamp(z + 10, 50, 200))}
              className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
              title="Acercar"
            >
              <ZoomIn size={16} />
              +
            </button>

            {url && (
              <a
                href={url}
                download={filename || 'documento.pdf'}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-black flex items-center gap-2"
                title="Descargar PDF"
              >
                <Download size={16} />
                Descargar
              </a>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="text-white/70 hover:text-white transition-colors p-2"
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100">
          {url ? (
            <iframe
              title={title || 'PDF'}
              src={iframeSrc}
              className="w-full h-full"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              No hay PDF para mostrar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
