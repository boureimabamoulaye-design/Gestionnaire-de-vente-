import React from 'react';
import { PackageOpen } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-[#ECFDF5] text-[#047857] flex items-center justify-center mb-3">
        <PackageOpen className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
