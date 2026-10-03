import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  SlidersHorizontal,
  Plus,
  ChevronDown,
  FileText,
  ArrowDownLeft,
  AlertOctagon,
  BellRing,
} from 'lucide-react';
import { Entree, StockItem } from '../types';
import { formatDateTime, formatFCFA, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';

interface StockCardProps {
  item: StockItem;
  productEntries?: Entree[];
  onEditThreshold: (item: StockItem) => void;
  onAddStock?: (item: StockItem) => void;
  onViewReceipt?: (numeroRecu: string) => void;
}

export const StockCard: React.FC<StockCardProps> = ({
  item,
  productEntries = [],
  onEditThreshold,
  onAddStock,
  onViewReceipt,
}) => {
  const { isMasked } = usePrivacyMask();
  const [showEntries, setShowEntries] = useState(false);

  const isUnderThreshold = item.quantite_disponible <= item.seuil_alerte;
  const isRupture = item.statut === 'RUPTURE';

  const renderStatus = () => {
    if (item.statut === 'RUPTURE') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 shrink-0">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>RUPTURE</span>
        </span>
      );
    }
    if (item.statut === 'STOCK FAIBLE') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>FAIBLE</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>EN STOCK</span>
      </span>
    );
  };

  return (
    <div
      className={`transition-colors border-l-4 ${
        isRupture
          ? 'border-l-red-500 bg-red-50/20 hover:bg-red-50/35'
          : isUnderThreshold
          ? 'border-l-amber-500 bg-amber-50/25 hover:bg-amber-50/45'
          : 'border-l-transparent hover:bg-slate-50/80'
      }`}
    >
      <div className="px-3.5 py-2.5 sm:px-4 sm:py-3">
        {/* Version Mobile & Tablette (< lg) */}
        <div className="lg:hidden">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {item.produit_nom}
              </h3>
              {isRupture ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 shrink-0 animate-pulse"
                  title={`Rupture critique : stock épuisé (seuil: ${item.seuil_alerte})`}
                >
                  <AlertOctagon className="w-3 h-3 text-red-600 shrink-0" />
                  <span>Rupture critique</span>
                </span>
              ) : isUnderThreshold ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0"
                  title={`Stock inférieur ou égal au seuil de réapprovisionnement (${item.quantite_disponible} <= ${item.seuil_alerte})`}
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>&le; Seuil ({item.quantite_disponible}/{item.seuil_alerte})</span>
                </span>
              ) : (
                renderStatus()
              )}
            </div>

            <span
              className={`text-xs sm:text-sm font-mono font-bold tabular-nums shrink-0 ${
                item.statut === 'RUPTURE'
                  ? 'text-red-600'
                  : item.statut === 'STOCK FAIBLE'
                  ? 'text-amber-600'
                  : 'text-[#047857]'
              }`}
            >
              {formatNumber(item.quantite_disponible)} {item.unite}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="min-w-0 flex-1 flex items-center gap-1.5 font-mono tabular-nums truncate">
              <span className="font-sans text-slate-500 truncate">
                {item.categorie_nom || 'Non classé'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Entrées: <strong className="text-[#047857]">+{formatNumber(item.total_entrees)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Sorties: <strong className="text-slate-700">-{formatNumber(item.total_sorties)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {productEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEntries((v) => !v)}
                  className="h-7 px-2 rounded-lg text-[11px] font-semibold text-[#065F46] bg-[#ECFDF5] hover:bg-[#D1FAE5] inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Entrées ({productEntries.length})</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${showEntries ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
              {onAddStock && (
                <button
                  type="button"
                  onClick={() => onAddStock(item)}
                  className={`h-7 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 ${
                    isUnderThreshold
                      ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-2xs'
                      : 'text-white bg-[#047857] hover:bg-[#065F46]'
                  }`}
                  title={isUnderThreshold ? 'Réapprovisionner ce produit' : 'Ajouter du stock'}
                >
                  <Plus className="w-3 h-3 shrink-0" strokeWidth={2.25} />
                  <span>Stock</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onEditThreshold(item)}
                className={`h-7 px-2 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer shrink-0 ${
                  isUnderThreshold
                    ? 'text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300'
                    : 'text-slate-700 bg-slate-100 hover:bg-[#ECFDF5] hover:text-[#047857]'
                }`}
                title={`Seuil de réapprovisionnement : ${item.seuil_alerte} unités (cliquer pour modifier)`}
              >
                <SlidersHorizontal className="w-3 h-3 shrink-0" />
                <span className="font-mono tabular-nums">{item.seuil_alerte}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Version PC / Desktop (>= lg) : Ligne de tableau alignée sur 12 colonnes */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
          <div className="col-span-3 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{item.produit_nom}</p>
              {isRupture ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 shrink-0 animate-pulse"
                  title="Rupture de stock : Réapprovisionnement urgent"
                >
                  <AlertOctagon className="w-3 h-3 text-red-600 shrink-0" />
                  <span>Rupture</span>
                </span>
              ) : isUnderThreshold ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0"
                  title={`Stock inférieur ou égal au seuil de réapprovisionnement (${item.quantite_disponible} <= ${item.seuil_alerte})`}
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>&le; Seuil</span>
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              MAJ {formatDateTime(item.derniere_mise_a_jour)}
            </p>
          </div>

          <div className="col-span-1 text-xs text-slate-600 truncate">
            {item.categorie_nom || 'Non classé'}
          </div>

          <div className="col-span-1 text-right font-mono text-xs text-[#047857] font-semibold tabular-nums whitespace-nowrap">
            +{formatNumber(item.total_entrees)}
          </div>

          <div className="col-span-1 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
            -{formatNumber(item.total_sorties)}
          </div>

          <div className="col-span-3 flex items-center justify-end gap-2 pr-3 whitespace-nowrap min-w-0">
            {renderStatus()}
            <span
              className={`font-mono text-sm font-bold tabular-nums whitespace-nowrap ${
                item.statut === 'RUPTURE'
                  ? 'text-red-600'
                  : item.statut === 'STOCK FAIBLE'
                  ? 'text-amber-600'
                  : 'text-[#047857]'
              }`}
            >
              {formatNumber(item.quantite_disponible)} {item.unite}
            </span>
          </div>

          <div className="col-span-3 flex items-center justify-end gap-1.5 whitespace-nowrap min-w-0">
            {productEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setShowEntries((v) => !v)}
                className="h-8 px-2 rounded-lg text-xs font-semibold text-[#065F46] bg-[#ECFDF5] hover:bg-[#D1FAE5] inline-flex items-center gap-1 cursor-pointer shrink-0"
                title="Voir les entrées liées à ce produit"
              >
                <span>Entrées ({productEntries.length})</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${showEntries ? 'rotate-180' : ''}`}
                />
              </button>
            )}
            {onAddStock && (
              <button
                type="button"
                onClick={() => onAddStock(item)}
                className={`h-8 px-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 ${
                  isUnderThreshold
                    ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-2xs'
                    : 'text-white bg-[#047857] hover:bg-[#065F46]'
                }`}
                title={isUnderThreshold ? 'Réapprovisionner ce produit' : 'Ajouter du stock'}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                <span>Stock</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onEditThreshold(item)}
              className={`h-8 px-2 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer shrink-0 ${
                isUnderThreshold
                  ? 'text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300'
                  : 'text-slate-700 bg-slate-100 hover:bg-[#ECFDF5] hover:text-[#047857]'
              }`}
              title={`Seuil de réapprovisionnement : ${item.seuil_alerte} unités (cliquer pour modifier)`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">{item.seuil_alerte}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Détail déroulant des Entrées liées à ce produit */}
      {showEntries && productEntries.length > 0 && (
        <div className="px-3.5 py-2.5 sm:px-4 bg-[#ECFDF5]/40 border-t border-slate-100 space-y-1.5">
          <p className="text-[11px] font-bold text-[#065F46] flex items-center gap-1.5">
            <ArrowDownLeft className="w-3.5 h-3.5 text-[#047857]" />
            <span>Entrées enregistrées pour {item.produit_nom} ({productEntries.length})</span>
          </p>
          <div className="divide-y divide-slate-200/60 bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {productEntries.map((ent) => (
              <div
                key={ent.id}
                className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1 flex items-center gap-2 truncate">
                  <span className="font-mono font-bold text-[#047857] shrink-0">
                    +{formatNumber(ent.quantite)} {ent.unite || item.unite}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-slate-700 truncate">
                    {ent.fournisseur_nom}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[11px] text-slate-400 truncate">
                    {formatDateTime(ent.date_achat)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-semibold text-slate-800">
                    {formatSensitiveFCFA(ent.prix_total || 0, isMasked)}
                  </span>
                  {onViewReceipt && (
                    <button
                      type="button"
                      onClick={() => onViewReceipt(ent.numero_recu)}
                      className="h-6 px-2 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3 text-[#047857]" />
                      <span>Reçu</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
