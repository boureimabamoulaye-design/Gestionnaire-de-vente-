import React, { useMemo, useState } from 'react';
import {
  History,
  ShoppingBag,
  ArrowDownLeft,
  Calendar,
  FileText,
  FileDown,
  Trash2,
  ArrowUp,
  RotateCcw,
} from 'lucide-react';
import { Categorie, Entree, Recu, Sortie } from '../types';
import {
  formatDateTime,
  formatFCFA,
  formatNumber,
  getTodayInputDate,
} from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';
import { pdfService } from '../services/pdfService';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface HistoryScreenProps {
  entrees: Entree[];
  sorties: Sortie[];
  categories: Categorie[];
  recus: Recu[];
  onOpenReceipt: (recu: Recu) => void;
  onDeleteEntree?: (id: number) => Promise<void>;
  onDeleteSortie?: (id: number) => Promise<void>;
}

type DateFilterMode = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
type OperationTypeFilter = 'ALL' | 'VENTE' | 'ENTREE';

interface UnifiedOperation {
  uid: string;
  id: number;
  type: 'VENTE' | 'ENTREE';
  numero_recu: string;
  date_op: string;
  date_day: string;
  produit_id: number;
  produit_nom: string;
  categorie_id: number;
  categorie_nom: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  prix_total: number;
  partenaire_nom: string;
  partenaire_contact: string;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  entrees,
  sorties,
  categories,
  recus,
  onOpenReceipt,
  onDeleteEntree,
  onDeleteSortie,
}) => {
  const { isMasked } = usePrivacyMask();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<OperationTypeFilter>('ALL');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [dateMode, setDateMode] = useState<DateFilterMode>('ALL');
  const [dateDebut, setDateDebut] = useState<string>(getTodayInputDate());
  const [dateFin, setDateFin] = useState<string>(getTodayInputDate());

  const [deletingOp, setDeletingOp] = useState<UnifiedOperation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fusion chronologique de toutes les opérations (Ventes + Achats/Entrées)
  const allOperations = useMemo<UnifiedOperation[]>(() => {
    const mappedSales: UnifiedOperation[] = sorties.map((s) => ({
      uid: `VENTE-${s.id}`,
      id: s.id,
      type: 'VENTE',
      numero_recu: s.numero_recu,
      date_op: s.date_vente,
      date_day: String(s.date_vente || '').slice(0, 10),
      produit_id: s.produit_id,
      produit_nom: s.produit_nom || `Produit #${s.produit_id}`,
      categorie_id: s.categorie_id,
      categorie_nom: s.categorie_nom || 'Non classé',
      unite: s.unite || 'Unité',
      quantite: Number(s.quantite || 0),
      prix_unitaire: Number(s.prix_unitaire || 0),
      prix_total: Number(s.prix_total || 0),
      partenaire_nom: s.client_nom || 'Client Comptant',
      partenaire_contact: s.client_contact || '',
    }));

    const mappedEntries: UnifiedOperation[] = entrees.map((e) => ({
      uid: `ENTREE-${e.id}`,
      id: e.id,
      type: 'ENTREE',
      numero_recu: e.numero_recu,
      date_op: e.date_achat,
      date_day: String(e.date_achat || '').slice(0, 10),
      produit_id: e.produit_id,
      produit_nom: e.produit_nom || `Produit #${e.produit_id}`,
      categorie_id: e.categorie_id,
      categorie_nom: e.categorie_nom || 'Non classé',
      unite: e.unite || 'Unité',
      quantite: Number(e.quantite || 0),
      prix_unitaire: Number(e.prix_unitaire || 0),
      prix_total: Number(e.prix_total || 0),
      partenaire_nom: e.fournisseur_nom || 'Approvisionnement Stock',
      partenaire_contact: e.fournisseur_contact || '',
    }));

    return [...mappedSales, ...mappedEntries].sort((a, b) => {
      if (b.date_op !== a.date_op) {
        return b.date_op.localeCompare(a.date_op);
      }
      return b.id - a.id;
    });
  }, [sorties, entrees]);

  // Plage de dates active selon le mode sélectionné
  const activeDateBounds = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (dateMode === 'TODAY') {
      return { start: todayStr, end: todayStr };
    }
    if (dateMode === 'WEEK') {
      const d = new Date(now);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      const startWeek = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { start: startWeek, end: todayStr };
    }
    if (dateMode === 'MONTH') {
      const startMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      const endMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-31`;
      return { start: startMonth, end: endMonth };
    }
    if (dateMode === 'CUSTOM') {
      return {
        start: dateDebut || '2000-01-01',
        end: dateFin || '2099-12-31',
      };
    }
    return null;
  }, [dateMode, dateDebut, dateFin]);

  const filteredOperations = useMemo(() => {
    return allOperations.filter((op) => {
      if (typeFilter !== 'ALL' && op.type !== typeFilter) return false;
      if (catFilter !== 'ALL' && String(op.categorie_id) !== catFilter) return false;

      if (activeDateBounds) {
        if (op.date_day < activeDateBounds.start || op.date_day > activeDateBounds.end) {
          return false;
        }
      }

      const q = search.trim().toLowerCase();
      if (q) {
        const match =
          op.produit_nom.toLowerCase().includes(q) ||
          op.partenaire_nom.toLowerCase().includes(q) ||
          op.partenaire_contact.toLowerCase().includes(q) ||
          op.numero_recu.toLowerCase().includes(q) ||
          op.categorie_nom.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [allOperations, typeFilter, catFilter, activeDateBounds, search]);

  const summary = useMemo(() => {
    let totalVentes = 0;
    let countVentes = 0;
    let totalAchats = 0;
    let countAchats = 0;

    for (const op of filteredOperations) {
      if (op.type === 'VENTE') {
        totalVentes += op.prix_total;
        countVentes += 1;
      } else {
        totalAchats += op.prix_total;
        countAchats += 1;
      }
    }

    return {
      totalVentes,
      countVentes,
      totalAchats,
      countAchats,
      totalCount: filteredOperations.length,
    };
  }, [filteredOperations]);

  const handleViewReceipt = (op: UnifiedOperation) => {
    const found = recus.find((r) => r.numero_recu === op.numero_recu);
    if (found) {
      onOpenReceipt(found);
      return;
    }
    onOpenReceipt({
      id: op.id,
      numero_recu: op.numero_recu,
      type_operation: op.type,
      sortie_id: op.type === 'VENTE' ? op.id : null,
      entree_id: op.type === 'ENTREE' ? op.id : null,
      date_recu: op.date_op,
      partenaire_nom: op.partenaire_nom,
      partenaire_contact: op.partenaire_contact,
      produit_nom: op.produit_nom,
      categorie_nom: op.categorie_nom,
      unite: op.unite,
      quantite: op.quantite,
      prix_unitaire: op.prix_unitaire,
      prix_total: op.prix_total,
      total_general: op.prix_total,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletingOp) return;
    setSubmitting(true);
    try {
      if (deletingOp.type === 'VENTE' && onDeleteSortie) {
        await onDeleteSortie(deletingOp.id);
      } else if (deletingOp.type === 'ENTREE' && onDeleteEntree) {
        await onDeleteEntree(deletingOp.id);
      }
      setDeletingOp(null);
    } finally {
      setSubmitting(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setCatFilter('ALL');
    setDateMode('ALL');
    setDateDebut(getTodayInputDate());
    setDateFin(getTodayInputDate());
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
            Historique des opérations
          </h1>
          <p className="text-xs text-slate-500 truncate">
            Journal chronologique complet des ventes et des achats / entrées
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(search || typeFilter !== 'ALL' || catFilter !== 'ALL' || dateMode !== 'ALL') && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#047857]" />
              <span>Réinitialiser</span>
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              pdfService.exportHistoryToPDF(
                filteredOperations,
                summary,
                activeDateBounds
                  ? `${activeDateBounds.start} au ${activeDateBounds.end}`
                  : 'Toutes les dates'
              )
            }
            icon={<FileDown className="w-4 h-4 text-[#047857]" />}
          >
            PDF
          </Button>
        </div>
      </div>

      {/* Résumé des opérations filtrées */}
      <div className="bg-white border border-slate-200/90 rounded-2xl divide-y md:divide-y-0 md:divide-x divide-slate-100 md:grid md:grid-cols-3 overflow-hidden">
        <div className="px-4 py-3 bg-[#ECFDF5]/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-4 h-4 text-[#047857] shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-[#065F46] block truncate">
                Ventes ({formatNumber(summary.countVentes)})
              </span>
            </div>
          </div>
          <span className="text-sm sm:text-base font-mono font-bold text-[#047857] tabular-nums shrink-0">
            {formatSensitiveFCFA(summary.totalVentes, isMasked)}
          </span>
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowDownLeft className="w-4 h-4 text-slate-700 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-700 block truncate">
                Achats / Entrées ({formatNumber(summary.countAchats)})
              </span>
            </div>
          </div>
          <span className="text-sm sm:text-base font-mono font-bold text-slate-900 tabular-nums shrink-0">
            {formatSensitiveFCFA(summary.totalAchats, isMasked)}
          </span>
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-[#047857] shrink-0" />
            <span className="text-xs font-semibold text-slate-600 truncate">
              Total opérations affichées
            </span>
          </div>
          <strong className="font-mono text-sm sm:text-base font-bold text-slate-900 tabular-nums shrink-0">
            {formatNumber(summary.totalCount)}
          </strong>
        </div>
      </div>

      {/* Filtres : Période / Date, Type d'opération, Recherche & Catégorie */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
        {/* 1. Filtre par Date */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#047857]" />
            <span>Filtrer par date :</span>
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'ALL', label: 'Toutes les dates' },
              { id: 'TODAY', label: "Aujourd'hui" },
              { id: 'WEEK', label: 'Cette semaine' },
              { id: 'MONTH', label: 'Ce mois' },
              { id: 'CUSTOM', label: 'Choisir une date' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDateMode(d.id as DateFilterMode)}
                className={`h-8 px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  dateMode === d.id
                    ? 'bg-[#047857] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sélecteur de plage de dates (si "Choisir une date" est actif) */}
        {dateMode === 'CUSTOM' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
            <Input
              label="Date de début"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
            <Input
              label="Date de fin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
        )}

        {/* 2. Filtre par Type (Toutes / Ventes / Achats) */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {[
            { id: 'ALL', label: `Toutes (${allOperations.length})` },
            { id: 'VENTE', label: `Ventes (${sorties.length})` },
            { id: 'ENTREE', label: `Achats (${entrees.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id as OperationTypeFilter)}
              className={`h-8 px-2.5 rounded-xl text-xs font-semibold transition-colors truncate cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3. Recherche & Catégorie */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-0.5">
          <div className="md:col-span-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Rechercher par produit, client, fournisseur, N° reçu..."
            />
          </div>
          <Select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'Toutes les catégories' },
              ...categories.map((c) => ({ value: String(c.id), label: c.nom })),
            ]}
          />
        </div>
      </div>

      {/* Liste chronologique des opérations */}
      {filteredOperations.length === 0 ? (
        <EmptyState
          title="Aucune opération trouvée pour cette période"
          description="Modifiez le filtre de date ou vos critères de recherche."
        />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          <div className="lg:hidden px-3.5 py-2 sm:px-4 bg-slate-50/80 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>HISTORIQUE CHRONOLOGIQUE ({filteredOperations.length})</span>
            <span>MONTANT & REÇU</span>
          </div>

          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 px-4 py-2.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
            <span className="col-span-2">DATE & TYPE</span>
            <span className="col-span-3">PRODUIT & N° REÇU</span>
            <span className="col-span-3">CLIENT / FOURNISSEUR</span>
            <span className="col-span-1 text-right">QUANTITÉ</span>
            <span className="col-span-2 text-right">MONTANT TOTAL</span>
            <span className="col-span-1 text-right">ACTIONS</span>
          </div>

          {filteredOperations.map((op) => {
            const isSale = op.type === 'VENTE';
            return (
              <div
                key={op.uid}
                className="px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 transition-colors"
              >
                {/* Version Mobile & Tablette (< lg) */}
                <div className="lg:hidden">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          isSale
                            ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isSale ? 'VENTE' : 'ACHAT'}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {op.produit_nom}
                      </h3>
                      <span
                        className={`text-[11px] font-mono font-semibold tabular-nums shrink-0 ${
                          isSale ? 'text-slate-600' : 'text-[#047857]'
                        }`}
                      >
                        · {isSale ? `-${formatNumber(op.quantite)}` : `+${formatNumber(op.quantite)}`}{' '}
                        {op.unite}
                      </span>
                    </div>

                    <span
                      className={`text-xs sm:text-sm font-mono font-bold tabular-nums shrink-0 ${
                        isSale ? 'text-[#047857]' : 'text-slate-900'
                      }`}
                    >
                      {formatSensitiveFCFA(op.prix_total, isMasked)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-slate-700 truncate">
                        {op.partenaire_nom}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-500 truncate">
                        {formatDateTime(op.date_op)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(op)}
                        className="h-7 px-2 rounded-lg bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <FileText className="w-3 h-3 shrink-0" />
                        <span>Reçu</span>
                      </button>
                      {((isSale && onDeleteSortie) || (!isSale && onDeleteEntree)) && (
                        <button
                          type="button"
                          onClick={() => setDeletingOp(op)}
                          title="Supprimer l'opération"
                          className="h-7 w-7 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Version PC / Desktop (>= lg) */}
                <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
                  <div className="col-span-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        isSale
                          ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isSale ? 'VENTE' : 'ENTRÉE / ACHAT'}
                    </span>
                    <p className="text-[11px] font-mono text-slate-500 mt-1 truncate">
                      {formatDateTime(op.date_op)}
                    </p>
                  </div>

                  <div className="col-span-3 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{op.produit_nom}</p>
                    <p className="text-[11px] font-mono text-slate-400 truncate">
                      {op.numero_recu} · {op.categorie_nom}
                    </p>
                  </div>

                  <div className="col-span-3 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {op.partenaire_nom}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 truncate">
                      {op.partenaire_contact || (isSale ? 'Client' : 'Fournisseur')}
                    </p>
                  </div>

                  <div
                    className={`col-span-1 text-right font-mono text-xs font-bold tabular-nums ${
                      isSale ? 'text-slate-700' : 'text-[#047857]'
                    }`}
                  >
                    {isSale ? `-${formatNumber(op.quantite)}` : `+${formatNumber(op.quantite)}`}{' '}
                    {op.unite}
                  </div>

                  <div className="col-span-2 text-right">
                    <p
                      className={`font-mono text-sm font-bold tabular-nums ${
                        isSale ? 'text-[#047857]' : 'text-slate-900'
                      }`}
                    >
                      {formatSensitiveFCFA(op.prix_total, isMasked)}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 tabular-nums">
                      PU: {formatSensitiveFCFA(op.prix_unitaire, isMasked)}
                    </p>
                  </div>

                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleViewReceipt(op)}
                      className="h-8 px-2.5 rounded-lg bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Reçu</span>
                    </button>
                    {((isSale && onDeleteSortie) || (!isSale && onDeleteEntree)) && (
                      <button
                        type="button"
                        onClick={() => setDeletingOp(op)}
                        title="Supprimer l'opération"
                        className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOperations.length > 3 && (
            <div className="px-3.5 py-2 bg-slate-50/60 flex justify-center">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="Retour en haut"
                title="Retour en haut"
                className="w-8 h-8 rounded-full bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5] flex items-center justify-center cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deletingOp}
        title="Supprimer l'opération"
        message={`Confirmez-vous la suppression de ${
          deletingOp?.type === 'VENTE' ? 'la vente' : "l'entrée"
        } "${deletingOp?.produit_nom}" (${deletingOp?.numero_recu}) ? Le stock sera automatiquement recalculé.`}
        confirmLabel="Supprimer"
        loading={submitting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingOp(null)}
      />
    </div>
  );
};
