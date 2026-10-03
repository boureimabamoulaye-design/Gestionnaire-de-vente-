import React from 'react';
import { FileText, Pencil, Trash2, User } from 'lucide-react';
import { Sortie } from '../types';
import { formatDateTime, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';

interface SaleCardProps {
  vente: Sortie;
  onViewReceipt: (numeroRecu: string) => void;
  onEdit?: (vente: Sortie) => void;
  onDelete?: (vente: Sortie) => void;
}

export const SaleCard: React.FC<SaleCardProps> = ({
  vente,
  onViewReceipt,
  onEdit,
  onDelete,
}) => {
  const { isMasked } = usePrivacyMask();

  return (
    <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 transition-colors">
      {/* Version Mobile & Tablette (< lg) */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {vente.produit_nom || `Produit #${vente.produit_id}`}
            </h3>
            <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
              · Qté: {formatNumber(vente.quantite)} {vente.unite || ''}
            </span>
          </div>

          <span className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums shrink-0">
            {formatSensitiveFCFA(vente.prix_total, isMasked)}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
            <User className="w-3 h-3 text-[#047857] shrink-0" strokeWidth={1.75} />
            <span className="font-semibold text-slate-700 truncate">{vente.client_nom}</span>
            {vente.client_contact && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-500 shrink-0">{vente.client_contact}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-slate-400 truncate">{formatDateTime(vente.date_vente)}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onViewReceipt(vente.numero_recu)}
              className="h-7 px-2.5 rounded-lg bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3" strokeWidth={1.75} />
              <span>Reçu</span>
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(vente)}
                aria-label="Modifier la vente"
                title="Modifier la vente"
                className="h-7 w-7 rounded-lg text-[#047857] bg-[#ECFDF5] hover:bg-[#D1FAE5] flex items-center justify-center transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(vente)}
                aria-label="Supprimer la vente"
                title="Supprimer la vente"
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
            {vente.produit_nom || `Produit #${vente.produit_id}`}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {vente.categorie_nom || 'Vente'} · <span className="font-mono">{vente.numero_recu}</span>
          </p>
        </div>

        <div className="col-span-3 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{vente.client_nom}</p>
          <p className="text-[11px] font-mono text-slate-500 truncate">
            {vente.client_contact || 'Sans contact'}
          </p>
        </div>

        <div className="col-span-2 text-xs text-slate-500 truncate">
          {formatDateTime(vente.date_vente)}
        </div>

        <div className="col-span-1 text-right font-mono text-xs font-semibold text-slate-800 tabular-nums">
          {formatNumber(vente.quantite)} {vente.unite || ''}
        </div>

        <div className="col-span-1 text-right font-mono text-sm font-bold text-[#047857] tabular-nums whitespace-nowrap">
          {formatSensitiveFCFA(vente.prix_total, isMasked)}
        </div>

        <div className="col-span-2 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onViewReceipt(vente.numero_recu)}
            className="h-8 px-2.5 rounded-lg bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5] text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Reçu</span>
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(vente)}
              aria-label="Modifier la vente"
              title="Modifier la vente"
              className="h-8 w-8 rounded-lg text-[#047857] bg-[#ECFDF5] hover:bg-[#D1FAE5] flex items-center justify-center transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(vente)}
              aria-label="Supprimer la vente"
              title="Supprimer la vente"
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
