import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-xs sm:max-w-sm bg-white border border-slate-200 rounded-2xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
              variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-[#ECFDF5] text-[#047857]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
