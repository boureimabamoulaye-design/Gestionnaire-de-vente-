import React, { useMemo, useState } from 'react';
import { Eye, FileDown, Printer, Trash2 } from 'lucide-react';
import { Recu } from '../types';
import { formatDateTime, formatFCFA, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';
import { pdfService } from '../services/pdfService';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ReceiptsScreenProps {
  recus: Recu[];
  onOpenReceipt: (recu: Recu) => void;
  onDeleteRecu?: (id: number) => Promise<void>;
}

export const ReceiptsScreen: React.FC<ReceiptsScreenProps> = ({
  recus,
  onOpenReceipt,
  onDeleteRecu,
}) => {
  const { isMasked } = usePrivacyMask();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'VENTE' | 'ENTREE'>('ALL');
  const [deletingRecu, setDeletingRecu] = useState<Recu | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deletingRecu || !onDeleteRecu) return;
    setSubmitting(true);
    try {
      await onDeleteRecu(deletingRecu.id);
      setDeletingRecu(null);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    return recus.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        r.numero_recu.toLowerCase().includes(q) ||
        r.partenaire_nom.toLowerCase().includes(q) ||
        r.produit_nom.toLowerCase().includes(q);
      const matchType = typeFilter === 'ALL' || r.type_operation === typeFilter;
      return matchSearch && matchType;
    });
  }, [recus, search, typeFilter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">Reçus</h1>
        <p className="text-xs text-slate-500">
          {formatNumber(filtered.length)} reçu(s) généré(s) — Voir, Imprimer, PDF et Partager
        </p>
      </div>

      {/* Search & Type Filter */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un reçu par numéro, client, fournisseur ou produit..."
        />

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: 'ALL', label: `Tous (${recus.length})` },
            {
              id: 'VENTE',
              label: `Ventes (${recus.filter((r) => r.type_operation === 'VENTE').length})`,
            },
            {
              id: 'ENTREE',
              label: `Entrées (${recus.filter((r) => r.type_operation === 'ENTREE').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id as any)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-[#047857] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Compact Receipts List */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Aucun reçu trouvé"
          description="Les reçus sont générés automatiquement à chaque vente ou entrée de stock."
        />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 px-4 py-2.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
            <span className="col-span-3">N° REÇU & DATE ({filtered.length})</span>
            <span className="col-span-3">PRODUIT & QUANTITÉ</span>
            <span className="col-span-2">CLIENT / FOURNISSEUR</span>
            <span className="col-span-2 text-right">TOTAL GÉNÉRAL</span>
            <span className="col-span-2 text-right">ACTIONS</span>
          </div>
          {filtered.map((recu) => (
            <div
              key={recu.id}
              className="px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 transition-colors"
            >
              {/* Version Mobile & Tablette (< lg) */}
              <div className="lg:hidden space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {recu.produit_nom}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                      · Qté: {formatNumber(recu.quantite)} {recu.unite || ''}
                    </span>
                  </div>

                  <span className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums shrink-0">
                    {formatSensitiveFCFA(recu.total_general, isMasked)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-slate-700 truncate">
                      {recu.partenaire_nom}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-600 shrink-0">{recu.numero_recu}</span>
                    <span className="hidden xs:inline" aria-hidden="true">·</span>
                    <span className="hidden xs:inline truncate">{formatDateTime(recu.date_recu)}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenReceipt(recu)}
                      className="h-7 px-2 rounded-lg bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3 shrink-0" />
                      <span>Voir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => pdfService.exportReceiptToPDF(recu)}
                      className="h-7 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FileDown className="w-3 h-3 text-[#047857] shrink-0" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenReceipt(recu)}
                      aria-label="Imprimer le reçu"
                      className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteRecu && (
                      <button
                        type="button"
                        onClick={() => setDeletingRecu(recu)}
                        aria-label="Supprimer le reçu"
                        title="Supprimer le reçu"
                        className="h-7 w-7 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Version PC / Desktop (>= lg) */}
              <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
                <div className="col-span-3 min-w-0">
                  <p className="font-mono text-xs font-bold text-slate-900 truncate">
                    {recu.numero_recu}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {formatDateTime(recu.date_recu)}
                  </p>
                </div>
                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{recu.produit_nom}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    Qté: {formatNumber(recu.quantite)} {recu.unite || ''} × {formatSensitiveFCFA(recu.prix_unitaire, isMasked)}
                  </p>
                </div>
                <div className="col-span-2 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{recu.partenaire_nom}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    {recu.partenaire_contact || recu.type_operation}
                  </p>
                </div>
                <div className="col-span-2 text-right font-mono text-sm font-bold text-[#047857] tabular-nums">
                  {formatSensitiveFCFA(recu.total_general, isMasked)}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenReceipt(recu)}
                    className="h-8 px-2.5 rounded-lg bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Voir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => pdfService.exportReceiptToPDF(recu)}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-[#047857]" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenReceipt(recu)}
                    aria-label="Imprimer le reçu"
                    className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  {onDeleteRecu && (
                    <button
                      type="button"
                      onClick={() => setDeletingRecu(recu)}
                      aria-label="Supprimer le reçu"
                      title="Supprimer le reçu"
                      className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deletingRecu}
        title="Supprimer le reçu"
        message={`Confirmez-vous la suppression du reçu "${deletingRecu?.numero_recu}" ?`}
        confirmLabel="Supprimer"
        loading={submitting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingRecu(null)}
      />
    </div>
  );
};
