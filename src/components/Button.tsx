import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-1.5 sm:gap-2 font-semibold rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variantStyles: Record<string, string> = {
    primary: 'bg-[#047857] text-white hover:bg-[#065F46] active:bg-[#064E3B] shadow-2xs',
    secondary: 'bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] border border-[#A7F3D0]/70',
    outline: 'bg-white text-[#0F172A] border border-slate-200 hover:bg-slate-50 active:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200',
  };

  const sizeStyles: Record<string, string> = {
    sm: 'min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 text-xs',
    md: 'min-h-[40px] sm:min-h-[42px] px-3.5 sm:px-4 py-2 text-xs sm:text-sm',
    lg: 'min-h-[44px] sm:min-h-[48px] px-4 sm:px-5 py-2.5 text-sm sm:text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>
      )}
      <span className="truncate">{children}</span>
    </button>
  );
};
