import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  padding = 'md',
}) => {
  const padMap = {
    none: 'p-0',
    sm: 'p-3.5',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200/90 rounded-2xl ${padMap[padding]} ${
        onClick ? 'cursor-pointer hover:border-[#059669]/50 transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
