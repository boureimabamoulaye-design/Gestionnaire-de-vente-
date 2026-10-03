import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Package, Plus } from 'lucide-react';
import { Produit } from '../types';
import { formatFCFA, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';

interface ProductComboboxProps {
  label?: string;
  produits: Produit[];
  allProduits?: Produit[];
  value: number;
  onChange: (prodId: number, product?: Produit) => void;
  customName?: string;
  onCustomNameChange?: (name: string) => void;
  mode?: 'sale' | 'entry';
  placeholder?: string;
  error?: string;
}

const normalizeText = (str: string) =>
  (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const ProductCombobox: React.FC<ProductComboboxProps> = ({
  label = 'Produit *',
  produits,
  allProduits,
  value,
  onChange,
  customName = '',
  onCustomNameChange,
  mode = 'sale',
  placeholder = 'Saisir ou choisir un produit...',
  error,
}) => {
  const { isMasked } = usePrivacyMask();
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sourceList = allProduits && allProduits.length > 0 ? allProduits : produits;

  const selectedProduct = useMemo(() => {
    if (!value || Number(value) <= 0) return null;
    return (
      produits.find((p) => Number(p.id) === Number(value)) ||
      sourceList.find((p) => Number(p.id) === Number(value)) ||
      null
    );
  }, [produits, sourceList, value]);

  // Filtrage des produits selon la saisie de l'utilisateur
  const { primaryMatches, otherCategoryMatches } = useMemo(() => {
    const q = normalizeText(searchText);
    if (!q) {
      return { primaryMatches: produits, otherCategoryMatches: [] as Produit[] };
    }

    const matchFn = (p: Produit) =>
      normalizeText(p.nom).includes(q) ||
      normalizeText(p.categorie_nom || '').includes(q) ||
      normalizeText(p.unite || '').includes(q);

    const primary = produits.filter(matchFn);

    const primaryIds = new Set(produits.map((p) => Number(p.id)));
    const others =
      allProduits && allProduits.length > produits.length
        ? allProduits.filter((p) => !primaryIds.has(Number(p.id)) && matchFn(p))
        : [];

    return { primaryMatches: primary, otherCategoryMatches: others };
  }, [produits, allProduits, searchText]);

  const combinedMatches = useMemo(
    () => [...primaryMatches, ...otherCategoryMatches],
    [primaryMatches, otherCategoryMatches]
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchText, isOpen]);

  // Fermeture au clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen) {
          const trimmed = searchText.trim();
          if (trimmed !== '') {
            const exact = combinedMatches.find(
              (p) => normalizeText(p.nom) === normalizeText(trimmed)
            );
            if (exact) {
              onChange(exact.id, exact);
              if (onCustomNameChange) onCustomNameChange('');
            } else if (mode === 'entry' && onCustomNameChange) {
              onChange(0, undefined);
              onCustomNameChange(trimmed);
            } else if (combinedMatches.length > 0) {
              const pick = combinedMatches[highlightedIndex] || combinedMatches[0];
              onChange(pick.id, pick);
            }
          }
          setIsOpen(false);
          setSearchText('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, searchText, combinedMatches, highlightedIndex, onChange, onCustomNameChange, mode]);

  const handleSelectProduct = (prod: Produit) => {
    onChange(prod.id, prod);
    if (onCustomNameChange) onCustomNameChange('');
    setSearchText('');
    setIsOpen(false);
  };

  const handleSelectCustomProduct = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange(0, undefined);
    if (onCustomNameChange) onCustomNameChange(trimmed);
    setSearchText('');
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    if (!selectedProduct && customName && !searchText) {
      setSearchText(customName);
    }
    setIsOpen(true);
  };

  const handleClearAndSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchText('');
    if (onCustomNameChange) onCustomNameChange('');
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (combinedMatches.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % combinedMatches.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (combinedMatches.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + combinedMatches.length) % combinedMatches.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (combinedMatches.length > 0) {
        const chosen = combinedMatches[highlightedIndex] || combinedMatches[0];
        handleSelectProduct(chosen);
      } else if (mode === 'entry' && searchText.trim() !== '') {
        handleSelectCustomProduct(searchText);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchText('');
      inputRef.current?.blur();
    }
  };

  const displayValue = isOpen
    ? searchText
    : selectedProduct
    ? `${selectedProduct.nom} (Dispo: ${formatNumber(selectedProduct.stock_disponible)} ${selectedProduct.unite})`
    : customName
    ? `${customName} (Nouveau produit)`
    : '';

  const dynamicPlaceholder =
    isOpen && selectedProduct
      ? `Rechercher... (${selectedProduct.nom})`
      : placeholder;

  const hasExactMatch = useMemo(() => {
    const q = normalizeText(searchText);
    if (!q) return true;
    return combinedMatches.some((p) => normalizeText(p.nom) === q);
  }, [searchText, combinedMatches]);

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onFocus={handleInputFocus}
          onClick={() => {
            if (!isOpen) setIsOpen(true);
          }}
          onChange={(e) => {
            const val = e.target.value;
            setSearchText(val);
            if (mode === 'entry' && onCustomNameChange) {
              const exact = sourceList.find(
                (p) => normalizeText(p.nom) === normalizeText(val)
              );
              if (exact) {
                onChange(exact.id, exact);
                onCustomNameChange('');
              } else {
                onCustomNameChange(val.trim());
                if (val.trim() !== '') {
                  onChange(0, undefined);
                }
              }
            }
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={dynamicPlaceholder}
          autoComplete="off"
          className={`w-full min-h-[44px] pl-9 pr-16 py-2.5 text-sm text-slate-900 bg-white border rounded-xl transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#047857] ${
            error ? 'border-red-500' : isOpen ? 'border-[#047857] ring-2 ring-[#059669]/20' : 'border-slate-200'
          }`}
        />

        <div className="absolute right-2 flex items-center gap-0.5">
          {(searchText !== '' || selectedProduct || customName) && (
            <button
              type="button"
              onClick={handleClearAndSearch}
              title="Saisir pour rechercher un produit"
              aria-label="Effacer et rechercher"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setSearchText('');
              } else {
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 0);
              }
            }}
            aria-label="Afficher la liste des produits"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180 text-[#047857]' : ''}`}
            />
          </button>
        </div>
      </div>

      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}

      {/* Liste déroulante filtrable en temps réel */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 sm:max-h-64 overflow-y-auto overscroll-contain divide-y divide-slate-100">
          {mode === 'entry' && searchText.trim() !== '' && !hasExactMatch && (
            <button
              type="button"
              onClick={() => handleSelectCustomProduct(searchText)}
              className="w-full text-left px-3.5 py-2.5 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#065F46] flex items-center justify-between gap-2 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Plus className="w-4 h-4 text-[#047857] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold truncate">
                    Ajouter « {searchText.trim()} » au stock
                  </p>
                  <p className="text-[11px] text-[#047857] truncate">
                    Création automatique du produit et entrée en stock
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#047857] text-white shrink-0">
                Nouveau
              </span>
            </button>
          )}

          {combinedMatches.length === 0 ? (
            mode === 'entry' && searchText.trim() !== '' ? null : (
              <div className="p-3.5 text-center text-xs text-slate-500 flex flex-col items-center gap-1">
                <Package className="w-4 h-4 text-slate-400" />
                <span>
                  Aucun produit trouvé{searchText.trim() ? ` pour "${searchText}"` : ''}.
                </span>
              </div>
            )
          ) : (
            <>
              {primaryMatches.map((p, idx) => {
                const isSelected = Number(p.id) === Number(value);
                const isHighlighted = idx === highlightedIndex;
                const stock = Number(p.stock_disponible || 0);
                const unitPrice = mode === 'sale' ? p.prix_vente || p.prix_achat || 0 : p.prix_achat || 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#ECFDF5] text-[#065F46]'
                        : isHighlighted
                        ? 'bg-slate-50 text-slate-900'
                        : 'bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-semibold truncate">{p.nom}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#047857] shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        {p.categorie_nom && <span className="truncate">{p.categorie_nom}</span>}
                        <span>•</span>
                        <span className="font-mono font-medium text-slate-700">
                          {unitPrice > 0 ? formatSensitiveFCFA(unitPrice, isMasked) : `Unité: ${p.unite}`}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                        stock <= 0
                          ? 'bg-red-50 text-red-700 border border-red-200/70'
                          : stock <= Number(p.seuil_alerte || 10)
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                          : 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                      }`}
                    >
                      Dispo: {formatNumber(stock)} {p.unite}
                    </span>
                  </button>
                );
              })}

              {otherCategoryMatches.length > 0 && (
                <>
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Autres catégories ({otherCategoryMatches.length})
                  </div>
                  {otherCategoryMatches.map((p, idx) => {
                    const globalIdx = primaryMatches.length + idx;
                    const isSelected = Number(p.id) === Number(value);
                    const isHighlighted = globalIdx === highlightedIndex;
                    const stock = Number(p.stock_disponible || 0);
                    const unitPrice = mode === 'sale' ? p.prix_vente || p.prix_achat || 0 : p.prix_achat || 0;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        onMouseEnter={() => setHighlightedIndex(globalIdx)}
                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#ECFDF5] text-[#065F46]'
                            : isHighlighted
                            ? 'bg-slate-50 text-slate-900'
                            : 'bg-white text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-semibold truncate">{p.nom}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#047857] shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            {p.categorie_nom && <span className="truncate">{p.categorie_nom}</span>}
                            <span>•</span>
                            <span className="font-mono font-medium text-slate-700">
                              {unitPrice > 0 ? formatSensitiveFCFA(unitPrice, isMasked) : `Unité: ${p.unite}`}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                            stock <= 0
                              ? 'bg-red-50 text-red-700 border border-red-200/70'
                              : stock <= Number(p.seuil_alerte || 10)
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                              : 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                          }`}
                        >
                          Dispo: {formatNumber(stock)} {p.unite}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
