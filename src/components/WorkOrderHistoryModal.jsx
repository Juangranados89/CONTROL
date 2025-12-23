import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';

const safeJson = (value) => {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
};

const formatDateTime = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-CO');
};

const actionLabel = (action) => {
  switch (action) {
    case 'CREATE_WORK_ORDER':
      return 'Creación de OT';
    case 'UPDATE_WORK_ORDER':
      return 'Actualización de OT';
    case 'DELETE_WORK_ORDER':
      return 'Eliminación de OT';
    case 'WORK_ORDER_NOTE':
      return 'Bitácora';
    default:
      return String(action || 'Evento');
  }
};

export default function WorkOrderHistoryModal({ open, workOrder, entries, loading, onRefresh, onAddNote, onClose }) {
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (!open) return;
    setNoteText('');
  }, [open, workOrder?.id]);

  const title = useMemo(() => {
    if (!workOrder) return 'Historial / Bitácora';
    const label = workOrder.otNumber ?? workOrder.id;
    const vehicle = [workOrder.vehicleCode || workOrder.code, workOrder.plate].filter(Boolean).join(' — ');
    return `Historial / Bitácora — OT #${label}${vehicle ? ` — ${vehicle}` : ''}`;
  }, [workOrder]);

  const normalized = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];
    return list
      .map((e) => {
        const details = safeJson(e?.details);
        const message = typeof details === 'object' && details ? details.message : null;
        const status = typeof details === 'object' && details ? details.status : null;
        const parts = [];
        if (message) parts.push(String(message));
        if (status) parts.push(`Estado: ${status}`);
        const summary = parts.join(' · ');

        return {
          id: e?.id || `${e?.createdAt || ''}-${e?.action || ''}`,
          createdAt: e?.createdAt || null,
          action: e?.action || null,
          userEmail: e?.userEmail || null,
          summary
        };
      })
      .sort((a, b) => {
        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
  }, [entries]);

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

  const handleAdd = useCallback(async () => {
    const text = String(noteText || '').trim();
    if (!text || !workOrder?.id) return;
    await onAddNote?.(workOrder.id, text);
    setNoteText('');
  }, [noteText, onAddNote, workOrder?.id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="bg-slate-800 px-5 py-3 flex items-center justify-between text-white">
          <h3 className="text-base font-bold truncate pr-3">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
              title="Refrescar"
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refrescar
            </button>
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

        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex gap-2">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Escribe una nota de bitácora..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center gap-2"
              disabled={!noteText.trim() || loading || !workOrder?.id}
              title="Agregar nota"
            >
              <Plus size={16} />
              Agregar
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Las notas quedan registradas como bitácora de la OT.</p>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50">
          {loading ? (
            <div className="p-6 text-slate-500 text-sm">Cargando historial...</div>
          ) : normalized.length === 0 ? (
            <div className="p-6 text-slate-500 text-sm">No hay eventos registrados para esta OT.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {normalized.map((e) => (
                <div key={e.id} className="p-4 bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800">{actionLabel(e.action)}</div>
                      {e.summary ? <div className="text-sm text-slate-700 mt-1">{e.summary}</div> : null}
                      {e.userEmail ? <div className="text-xs text-slate-500 mt-1">{e.userEmail}</div> : null}
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(e.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
