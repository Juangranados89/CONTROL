import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const DialogContext = createContext(null);

const VARIANT_STYLES = {
  info: {
    icon: Info,
    iconClass: 'text-blue-600',
    titleClass: 'text-slate-900'
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    titleClass: 'text-slate-900'
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-600',
    titleClass: 'text-slate-900'
  },
  danger: {
    icon: AlertTriangle,
    iconClass: 'text-red-600',
    titleClass: 'text-slate-900'
  }
};

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const close = useCallback((result) => {
    if (dialog?.resolve) dialog.resolve(result);
    setDialog(null);
  }, [dialog]);

  const alert = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    return new Promise((resolve) => {
      setDialog({
        type: 'alert',
        title: opts.title || 'Mensaje',
        message: opts.message || '',
        variant: opts.variant || 'info',
        confirmText: opts.confirmText || 'Aceptar',
        resolve
      });
    });
  }, []);

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    return new Promise((resolve) => {
      setDialog({
        type: 'confirm',
        title: opts.title || 'Confirmar',
        message: opts.message || '',
        variant: opts.variant || 'warning',
        confirmText: opts.confirmText || 'Continuar',
        cancelText: opts.cancelText || 'Cancelar',
        resolve
      });
    });
  }, []);

  const value = useMemo(() => ({ alert, confirm }), [alert, confirm]);

  const variant = VARIANT_STYLES[dialog?.variant || 'info'] || VARIANT_STYLES.info;
  const Icon = variant.icon;

  return (
    <DialogContext.Provider value={value}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-start gap-3">
              <div className={`mt-0.5 ${variant.iconClass}`}>
                <Icon size={22} />
              </div>
              <div className="flex-1">
                <div className={`font-bold ${variant.titleClass}`}>{dialog.title}</div>
                <div className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{dialog.message}</div>
              </div>
            </div>

            <div className="p-4 flex justify-end gap-2">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => close(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  {dialog.cancelText}
                </button>
              )}
              <button
                onClick={() => close(dialog.type === 'confirm' ? true : undefined)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}
