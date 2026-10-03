import React from 'react';
import { Eye, Pencil, Trash2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Produit } from '../types';
import { formatNumber } from '../utils/formatters';

interface ProductCardProps {
  produit: Produit;
  onView: (produit: Produit) => void;
  onEdit: (produit: Produit) => void;
  onDelete: (produit: Produit) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  produit,
  onView,
  onEdit,
  onDelete,
}) => {
  const renderStockStatus = () => {
    if (produit.stock_statut === 'RUPTURE') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 shrink-0">
          <XCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span>RUPTURE</span>
        </span>
      );
    }
    if (produit.stock_statut === 'STOCK FAIBLE') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span>FAIBLE</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
        <span>EN STOCK</span>
      </span>
    );
  };

  return (
    <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 transition-colors">
      {/* Version Mobile & Tablette (< lg) */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate min-w-0 flex-1">
            {produit.nom}
          </h3>

          <span className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums shrink-0">
            {formatNumber(produit.stock_disponible)} {produit.unite}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
            <span className="text-slate-600 truncate">
              {produit.categorie_nom || 'Sans catégorie'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-500 shrink-0">
              Seuil: {formatNumber(produit.seuil_alerte)}
            </span>
            <span aria-hidden="true">·</span>
            {renderStockStatus()}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onView(produit)}
              title="Voir les détails"
              aria-label={`Détails de ${produit.nom}`}
              className="h-7 w-7 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => onEdit(produit)}
              title="Modifier"
              aria-label={`Modifier ${produit.nom}`}
              className="h-7 w-7 rounded-lg text-[#047857] bg-[#ECFDF5] hover:bg-[#D1FAE5] inline-flex items-center justify-center cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(produit)}
              aria-label={`Supprimer ${produit.nom}`}
              title="Supprimer"
              className="h-7 w-7 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* Version PC / Desktop (>= lg) : Tableau aligné sur 12 colonnes */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
        <div className="col-span-4 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{produit.nom}</p>
          <p className="text-[11px] text-slate-400 font-mono">Réf #{produit.id}</p>
        </div>

        <div className="col-span-2 min-w-0">
          <span className="text-xs font-medium text-slate-700 truncate block">
            {produit.categorie_nom || 'Sans catégorie'}
          </span>
        </div>

        <div className="col-span-2 text-xs text-slate-600 truncate">
          {produit.unite}
        </div>

        <div className="col-span-1 text-right font-mono text-xs text-slate-600 tabular-nums">
          {formatNumber(produit.seuil_alerte)}
        </div>

        <div className="col-span-2 flex items-center justify-end gap-2">
          <span className="font-mono text-xs font-bold text-[#047857] tabular-nums">
            {formatNumber(produit.stock_disponible)} {produit.unite}
          </span>
          {renderStockStatus()}
        </div>

        <div className="col-span-1 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onView(produit)}
            title="Voir les détails"
            aria-label={`Détails de ${produit.nom}`}
            className="h-8 w-8 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center cursor-pointer"
          >
            <Eye className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(produit)}
            title="Modifier"
            aria-label={`Modifier ${produit.nom}`}
            className="h-8 w-8 rounded-lg text-[#047857] bg-[#ECFDF5] hover:bg-[#D1FAE5] inline-flex items-center justify-center cursor-pointer"
          >
            <Pencil className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(produit)}
            aria-label={`Supprimer ${produit.nom}`}
            title="Supprimer"
            className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
};
