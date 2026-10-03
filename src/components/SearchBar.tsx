import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Rechercher...',
  className = '',
}) => {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[44px] pl-10 pr-10 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#047857] transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer la recherche"
          className="absolute right-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
