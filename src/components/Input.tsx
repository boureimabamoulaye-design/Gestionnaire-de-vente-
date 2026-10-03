import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rightAddon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  rightAddon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? `inp_${label.toLowerCase().replace(/\s+/g, '_')}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          id={inputId}
          className={`w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-xl transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#047857] ${
            error ? 'border-red-500' : 'border-slate-200'
          } ${rightAddon ? 'pr-16' : ''} ${className}`}
          {...props}
        />
        {rightAddon && (
          <div className="absolute right-3 text-xs font-mono font-medium text-slate-500 pointer-events-none">
            {rightAddon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string | number; label: string }>;
}

export const Select: React.FC<SelectProps> = ({ label, error, options, className = '', id, ...props }) => {
  const selectId = id || (label ? `sel_${label.toLowerCase().replace(/\s+/g, '_')}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#047857] ${
          error ? 'border-red-500' : 'border-slate-200'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
};
