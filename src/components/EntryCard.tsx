import React from 'react';
import { FileText, Trash2, Truck } from 'lucide-react';
import { Entree } from '../types';
import { formatDateTime, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';

interface EntryCardProps {
  entree: Entree;
  onViewReceipt: (numeroRecu: string) => void;
  onDelete?: (entree: Entree) => void;
}

export const EntryCard: React.FC<EntryCardProps> = ({ entree, onViewReceipt, onDelete }) => {
  const { isMasked } = usePrivacyMask();

  return (
    <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 transition-colors">
      {/* Version Mobile & Tablette (< lg) */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {entree.produit_nom || `Produit #${entree.produit_id}`}
            </h3>
            <span className="text-[11px] font-mono text-[#047857] font-semibold tabular-nums shrink-0">
              · +{formatNumber(entree.quantite)} {entree.unite || ''}
            </span>
          </div>

          <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums shrink-0">
            {formatSensitiveFCFA(entree.prix_total, isMasked)}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
            <Truck className="w-3 h-3 text-[#047857] shrink-0" strokeWidth={1.75} />
            <span className="font-semibold text-slate-700 truncate">{entree.fournisseur_nom}</span>
            {entree.fournisseur_contact && entree.fournisseur_contact !== '-' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-500 shrink-0">{entree.fournisseur_contact}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-slate-400 truncate">{formatDateTime(entree.date_achat)}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onViewReceipt(entree.numero_recu)}
              className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3 text-[#047857]" strokeWidth={1.75} />
              <span>Reçu</span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(entree)}
                aria-label="Supprimer l'entrée"
                title="Supprimer l'entrée"
                className="h-7 w-7 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Version PC / Desktop (>= lg) : Tableau aligné sur 12 colonnes */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
        <div className="col-span-3 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">
            {entree.produit_nom || `Produit #${entree.produit_id}`}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {entree.categorie_nom || 'Entrée'} · <span className="font-mono">{entree.numero_recu}</span>
          </p>
        </div>

        <div className="col-span-3 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{entree.fournisseur_nom}</p>
          <p className="text-[11px] font-mono text-slate-500 truncate">
            {entree.fournisseur_contact && entree.fournisseur_contact !== '-'
              ? entree.fournisseur_contact
              : 'Sans contact'}
          </p>
        </div>

        <div className="col-span-2 text-xs text-slate-500 truncate">
          {formatDateTime(entree.date_achat)}
        </div>

        <div className="col-span-1 text-right font-mono text-xs font-bold text-[#047857] tabular-nums">
          +{formatNumber(entree.quantite)} {entree.unite || ''}
        </div>

        <div className="col-span-2 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
          {formatSensitiveFCFA(entree.prix_total, isMasked)}
        </div>

        <div className="col-span-1 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onViewReceipt(entree.numero_recu)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#047857]" strokeWidth={1.75} />
            <span>Reçu</span>
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(entree)}
              aria-label="Supprimer l'entrée"
              title="Supprimer l'entrée"
              className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
