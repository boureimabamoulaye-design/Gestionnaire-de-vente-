import React from 'react';

interface LoadingProps {
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Chargement des données...' }) => {
  return (
    <div className="w-full py-12 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-[#047857] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-medium text-slate-500">{message}</p>
    </div>
  );
};
