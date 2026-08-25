
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = React.createContext<ToastContextType>({ toast: () => {} });

let toastIdCounter = 0;

export const useToast = () => React.useContext(ToastContext);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={20} />,
  error: <XCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};

const COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-blue-600 text-white',
};

const ToastItem: React.FC<{ t: Toast; onClose: (id: number) => void }> = ({ t, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(t.id), 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, [t.id, onClose]);

  return (
    <div
      className={`flex items-center gap-3 px-5 py-4 rounded-sm shadow-2xl ${COLORS[t.type]} transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
      style={{ minWidth: 280, maxWidth: 420 }}
    >
      {ICONS[t.type]}
      <span className="flex-1 text-sm font-bold italic">{t.message}</span>
      <button onClick={() => { setVisible(false); setTimeout(() => onClose(t.id), 300); }} className="opacity-60 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = React.useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onClose={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Modal de confirmação customizado (substitui window.confirm / alert complexos)
interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'success' | 'danger' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const TYPE_STYLES = {
  success: { btn: 'bg-emerald-600 hover:bg-emerald-700', icon: <CheckCircle size={32} className="text-emerald-500" /> },
  danger: { btn: 'bg-rose-600 hover:bg-rose-700', icon: <XCircle size={32} className="text-rose-500" /> },
  info: { btn: 'bg-blue-600 hover:bg-blue-700', icon: <Info size={32} className="text-blue-500" /> },
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', type = 'info', onConfirm, onCancel,
}) => {
  if (!open) return null;

  const styles = TYPE_STYLES[type];

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-sm shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          {styles.icon}
          <h3 className="text-lg font-black italic uppercase text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600 font-medium">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-slate-200 rounded-sm font-black uppercase italic text-xs text-slate-500 hover:bg-slate-50 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 ${styles.btn} text-white rounded-sm font-black uppercase italic text-xs transition-all shadow-lg`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// Tela de sucesso pós-envio
interface SuccessScreenProps {
  open: boolean;
  onClose: () => void;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-sm shadow-2xl max-w-sm w-full p-8 space-y-6 animate-in zoom-in-95 duration-300 text-center">
        <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle size={48} className="text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black italic uppercase text-slate-900">Relatório Enviado!</h2>
          <p className="text-sm text-slate-500 font-medium">Relatório salvo. A mensagem foi copiada: cole no grupo do WhatsApp e envie.</p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm font-black uppercase italic text-sm transition-all shadow-lg active:scale-95"
        >
          VOLTAR AO INÍCIO
        </button>
      </div>
    </div>
  );
};
