import React, { useMemo, useState } from 'react';
import {
  FileDown,
  X,
  Layers,
  Plus,
  CheckCircle2,
  ArrowDownLeft,
  AlertTriangle,
  AlertOctagon,
  BellRing,
} from 'lucide-react';
import { Categorie, Entree, Produit, Recu, StockItem } from '../types';
import { formatNumber } from '../utils/formatters';
import { pdfService } from '../services/pdfService';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { ProductCombobox } from '../components/ProductCombobox';
import { SearchBar } from '../components/SearchBar';
import { StockCard } from '../components/StockCard';
import { EntryCard } from '../components/EntryCard';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface StockScreenProps {
  stock: StockItem[];
  entrees?: Entree[];
  produits?: Produit[];
  categories: Categorie[];
  recus?: Recu[];
  onUpdateThreshold: (produitId: number, seuil: number) => Promise<void>;
  onAddStock?: (payload: {
    produit_id: number;
    produit_nom?: string;
    categorie_id: number;
    quantite: number;
  }) => Promise<void>;
  onOpenReceipt?: (recu: Recu) => void;
  onDeleteEntree?: (id: number) => Promise<void>;
}

export const StockScreen: React.FC<StockScreenProps> = ({
  stock,
  entrees = [],
  produits = [],
  categories,
  recus = [],
  onUpdateThreshold,
  onAddStock,
  onOpenReceipt,
  onDeleteEntree,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [catFilter, setCatFilter] = useState<string>('ALL');

  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [newThreshold, setNewThreshold] = useState<string>('10');
  const [deletingEntree, setDeletingEntree] = useState<Entree | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add Stock Modal states (linked to Entrées)
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [selectedStockProdId, setSelectedStockProdId] = useState<number>(0);
  const [customProductName, setCustomProductName] = useState<string>('');
  const [selectedAddCatId, setSelectedAddCatId] = useState<number>(categories[0]?.id || 1);
  const [addQuantity, setAddQuantity] = useState<string>('10');
  const [addStockError, setAddStockError] = useState<string>('');

  const counts = useMemo(() => {
    return {
      total: stock.length,
      enStock: stock.filter((s) => s.statut === 'EN STOCK').length,
      faible: stock.filter((s) => s.statut === 'STOCK FAIBLE').length,
      rupture: stock.filter((s) => s.statut === 'RUPTURE').length,
      unitesTotales: stock.reduce((acc, s) => acc + Number(s.quantite_disponible || 0), 0),
    };
  }, [stock]);

  // Regroupement des entrées par produit_id pour liaison directe avec chaque ligne de stock
  const entriesByProductId = useMemo(() => {
    const map: Record<number, Entree[]> = {};
    for (const e of entrees) {
      const pid = Number(e.produit_id);
      if (!map[pid]) map[pid] = [];
      map[pid].push(e);
    }
    return map;
  }, [entrees]);

  const filteredStock = useMemo(() => {
    return stock.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.produit_nom.toLowerCase().includes(q) ||
        (s.categorie_nom || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'ALL' || s.statut === statusFilter;
      const matchCat = catFilter === 'ALL' || String(s.categorie_id) === catFilter;
      return matchSearch && matchStatus && matchCat;
    });
  }, [stock, search, statusFilter, catFilter]);

  // Entrées filtrées pour apparaître directement au niveau du Stock
  const filteredEntreesInStock = useMemo(() => {
    return entrees.filter((e) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (e.produit_nom || '').toLowerCase().includes(q) ||
        e.fournisseur_nom.toLowerCase().includes(q) ||
        e.numero_recu.toLowerCase().includes(q);
      const matchCat = catFilter === 'ALL' || String(e.categorie_id) === catFilter;
      return matchSearch && matchCat;
    });
  }, [entrees, search, catFilter]);

  const selectedStockItem = useMemo(() => {
    if (!selectedStockProdId) return null;
    return stock.find((s) => Number(s.produit_id) === Number(selectedStockProdId)) || null;
  }, [stock, selectedStockProdId]);

  const openThresholdModal = (item: StockItem) => {
    setEditingItem(item);
    setNewThreshold(String(item.seuil_alerte));
  };

  const openAddStockModal = (item?: StockItem) => {
    const target = item || stock[0] || null;
    setSelectedStockProdId(target ? Number(target.produit_id) : 0);
    setSelectedAddCatId(Number(target?.categorie_id || categories[0]?.id || 1));
    setCustomProductName('');
    setAddQuantity('10');
    setAddStockError('');
    setIsAddStockOpen(true);
  };

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSubmitting(true);
    try {
      await onUpdateThreshold(editingItem.produit_id, Math.max(0, Number(newThreshold || 0)));
      setEditingItem(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddStock) return;
    setAddStockError('');

    const qty = Math.floor(Number(addQuantity));
    if ((!selectedStockProdId && !customProductName.trim()) || isNaN(qty) || qty <= 0) {
      setAddStockError('Veuillez choisir ou saisir un produit et une quantité supérieure à 0.');
      return;
    }

    const item = stock.find((s) => Number(s.produit_id) === Number(selectedStockProdId));
    const catId = Number(item?.categorie_id || selectedAddCatId || categories[0]?.id || 1);

    setSubmitting(true);
    try {
      await onAddStock({
        produit_id: Number(selectedStockProdId || 0),
        produit_nom: customProductName.trim() || item?.produit_nom || undefined,
        categorie_id: catId,
        quantite: qty,
      });
      setIsAddStockOpen(false);
    } catch (err: any) {
      setAddStockError(err?.message || "Erreur lors de l'ajout au stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewReceipt = (numeroRecu: string) => {
    if (!onOpenReceipt) return;
    const found = recus.find((r) => r.numero_recu === numeroRecu);
    if (found) {
      onOpenReceipt(found);
      return;
    }
    const entree = entrees.find((e) => e.numero_recu === numeroRecu);
    if (entree) {
      onOpenReceipt({
        id: entree.id,
        numero_recu: entree.numero_recu,
        type_operation: 'ENTREE',
        entree_id: entree.id,
        date_recu: entree.date_achat,
        partenaire_nom: entree.fournisseur_nom,
        partenaire_contact: entree.fournisseur_contact || '',
        produit_nom: entree.produit_nom || `Produit #${entree.produit_id}`,
        categorie_nom: entree.categorie_nom || '',
        unite: entree.unite || 'Unité',
        quantite: entree.quantite,
        prix_unitaire: entree.prix_unitaire,
        prix_total: entree.prix_total,
        total_general: entree.prix_total,
      });
    }
  };

  const handleConfirmDeleteEntree = async () => {
    if (!deletingEntree || !onDeleteEntree) return;
    setSubmitting(true);
    try {
      await onDeleteEntree(deletingEntree.id);
      setDeletingEntree(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">État du Stock</h1>
          <p className="text-xs text-slate-500 truncate">
            Lié en temps réel aux Entrées ({entrees.length}) et aux Sorties
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onAddStock && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => openAddStockModal()}
              icon={<Plus className="w-4 h-4" />}
            >
              Ajouter au stock
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => pdfService.exportStockToPDF(filteredStock)}
            icon={<FileDown className="w-4 h-4 text-[#047857]" />}
          >
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* Mécanisme de notification visuelle d'alerte de stock critique / réapprovisionnement */}
      {(counts.faible > 0 || counts.rupture > 0) && (
        <div className="bg-amber-50/95 border border-amber-300/80 rounded-2xl p-3 sm:p-4 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 relative mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-600 rounded-full" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs sm:text-sm font-bold text-amber-950">
                  Notification d'alerte : Réapprovisionnement requis
                </p>
                <div className="flex items-center gap-1">
                  {counts.rupture > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                      {counts.rupture} en rupture
                    </span>
                  )}
                  {counts.faible > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                      {counts.faible} sous le seuil
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                {counts.rupture + counts.faible} produit(s) ont une quantité disponible inférieure ou égale au seuil de réapprovisionnement configuré dans la base de données.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'STOCK FAIBLE' ? 'ALL' : 'STOCK FAIBLE')}
              className={`h-8 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                statusFilter === 'STOCK FAIBLE' || statusFilter === 'RUPTURE'
                  ? 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {statusFilter === 'STOCK FAIBLE' || statusFilter === 'RUPTURE'
                ? 'Afficher tous les produits'
                : 'Isoler les produits en alerte'}
            </button>
          </div>
        </div>
      )}

      {/* Compact Summary + Pretty Mini Status Pills */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 px-1 text-xs">
          <span className="text-slate-500 font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#047857]" />
            <span>Total disponible en stock</span>
          </span>
          <strong className="font-mono font-bold text-[#047857] tabular-nums text-xs">
            {formatNumber(counts.unitesTotales)} unités ({entrees.length} entrée(s))
          </strong>
        </div>

        {/* Clean 2x2 on mobile, 4-Element on sm+ Stock Filter Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            {
              id: 'ALL',
              label: 'Tout',
              count: counts.total,
              dot: 'bg-slate-400',
              idleClass: 'bg-slate-50/90 border-slate-200/80 text-slate-600 hover:bg-slate-100',
              activeClass: 'bg-slate-800 border-slate-800 text-white shadow-2xs',
              badgeClass: (isActive: boolean) =>
                isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700',
            },
            {
              id: 'EN STOCK',
              label: 'En stock',
              count: counts.enStock,
              dot: 'bg-[#059669]',
              idleClass:
                'bg-emerald-50/50 border-emerald-200/70 text-[#065F46] hover:bg-emerald-50',
              activeClass: 'bg-[#047857] border-[#047857] text-white shadow-2xs',
              badgeClass: (isActive: boolean) =>
                isActive ? 'bg-white/20 text-white' : 'bg-emerald-100/90 text-[#047857]',
            },
            {
              id: 'STOCK FAIBLE',
              label: 'Faible',
              count: counts.faible,
              dot: 'bg-amber-500',
              idleClass: 'bg-amber-50/50 border-amber-200/70 text-amber-800 hover:bg-amber-50',
              activeClass: 'bg-amber-600 border-amber-600 text-white shadow-2xs',
              badgeClass: (isActive: boolean) =>
                isActive ? 'bg-white/20 text-white' : 'bg-amber-100/90 text-amber-700',
            },
            {
              id: 'RUPTURE',
              label: 'Rupture',
              count: counts.rupture,
              dot: 'bg-red-500',
              idleClass: 'bg-red-50/50 border-red-200/70 text-red-700 hover:bg-red-50',
              activeClass: 'bg-red-600 border-red-600 text-white shadow-2xs',
              badgeClass: (isActive: boolean) =>
                isActive ? 'bg-white/20 text-white' : 'bg-red-100/90 text-red-700',
            },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`h-7 sm:h-8 px-1.5 sm:px-3 rounded-lg border text-[11px] sm:text-xs font-medium transition-all flex items-center justify-between gap-1 cursor-pointer min-w-0 ${
                  isActive ? tab.activeClass : tab.idleClass
                }`}
              >
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isActive ? 'bg-white' : tab.dot
                    }`}
                  />
                  <span className="truncate">{tab.label}</span>
                </span>
                <span
                  className={`px-1 py-0.2 rounded text-[10px] font-mono font-bold tabular-nums shrink-0 ${tab.badgeClass(
                    isActive
                  )}`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Category Select */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-0.5">
          <div className="md:col-span-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Rechercher un produit ou une entrée dans le stock..."
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

      {/* 1. État du Stock par Produit */}
      {filteredStock.length === 0 ? (
        <EmptyState
          title="Aucun article en stock pour ce filtre"
          description="Ajoutez une entrée ou cliquez sur Ajouter au stock."
          actionLabel={onAddStock ? 'Ajouter au stock' : undefined}
          onAction={onAddStock ? () => openAddStockModal() : undefined}
        />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          <div className="lg:hidden px-3.5 py-2 sm:px-4 bg-slate-50/80 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>ÉTAT DU STOCK ({filteredStock.length})</span>
            <span>DISPONIBLE & ENTRÉES</span>
          </div>
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 px-4 py-2.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
            <span className="col-span-3">PRODUIT ({filteredStock.length})</span>
            <span className="col-span-1">CATÉGORIE</span>
            <span className="col-span-1 text-right">ENTRÉES</span>
            <span className="col-span-1 text-right">SORTIES</span>
            <span className="col-span-3 text-right pr-3">STOCK DISPONIBLE</span>
            <span className="col-span-3 text-right">ACTIONS & SEUIL</span>
          </div>
          {filteredStock.map((item) => (
            <StockCard
              key={item.produit_id}
              item={item}
              productEntries={entriesByProductId[item.produit_id] || []}
              onEditThreshold={openThresholdModal}
              onAddStock={onAddStock ? openAddStockModal : undefined}
              onViewReceipt={onOpenReceipt ? handleViewReceipt : undefined}
            />
          ))}
        </div>
      )}

      {/* 2. Chaque Entrée apparaît directement au niveau du Stock */}
      {filteredEntreesInStock.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          <div className="px-3.5 py-2.5 sm:px-4 bg-[#ECFDF5]/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ArrowDownLeft className="w-4 h-4 text-[#047857] shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold text-[#065F46] truncate">
                Entrées enregistrées dans le Stock ({filteredEntreesInStock.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono font-semibold text-[#047857] shrink-0">
              Liées au stock
            </span>
          </div>
          {filteredEntreesInStock.map((entree) => (
            <EntryCard
              key={entree.id}
              entree={entree}
              onViewReceipt={handleViewReceipt}
              onDelete={onDeleteEntree ? (e) => setDeletingEntree(e) : undefined}
            />
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deletingEntree}
        title="Supprimer l'entrée du stock"
        message={`Confirmez-vous la suppression de l'entrée "${deletingEntree?.produit_nom}" (${deletingEntree?.numero_recu}) ? Le stock sera automatiquement recalculé.`}
        confirmLabel="Supprimer"
        loading={submitting}
        onConfirm={handleConfirmDeleteEntree}
        onCancel={() => setDeletingEntree(null)}
      />

      {/* Modal : Ajouter au stock (Crée automatiquement une Entrée liée au Stock) */}
      {isAddStockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Ajouter au stock (Entrée)</h3>
              <button
                type="button"
                onClick={() => setIsAddStockOpen(false)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStockSubmit} className="mt-4 space-y-4">
              {addStockError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {addStockError}
                </div>
              )}

              <Select
                label="Catégorie"
                value={selectedAddCatId}
                onChange={(e) => setSelectedAddCatId(Number(e.target.value))}
                options={categories.map((c) => ({ value: c.id, label: c.nom }))}
              />

              <ProductCombobox
                label="Produit *"
                produits={produits}
                allProduits={produits}
                value={selectedStockProdId}
                onChange={(prodId, prod) => {
                  setSelectedStockProdId(prodId);
                  if (prod?.categorie_id) setSelectedAddCatId(Number(prod.categorie_id));
                }}
                customName={customProductName}
                onCustomNameChange={setCustomProductName}
                mode="entry"
                placeholder="Choisir ou saisir un produit..."
              />

              {selectedStockItem && (
                <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between text-xs text-[#065F46]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" />
                    <span>
                      Actuel : {formatNumber(selectedStockItem.quantite_disponible)}{' '}
                      {selectedStockItem.unite}
                    </span>
                  </span>
                  <strong className="font-mono font-bold text-[#047857]">
                    Nouveau :{' '}
                    {formatNumber(
                      Number(selectedStockItem.quantite_disponible || 0) +
                        Math.max(0, Math.floor(Number(addQuantity || 0)))
                    )}{' '}
                    {selectedStockItem.unite}
                  </strong>
                </div>
              )}

              <Input
                label="Quantité à ajouter *"
                type="number"
                min="1"
                step="1"
                value={addQuantity}
                onChange={(e) => setAddQuantity(e.target.value)}
                rightAddon={selectedStockItem?.unite || 'Unités'}
                required
              />

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => setIsAddStockOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" fullWidth loading={submitting}>
                  Ajouter
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Threshold Web Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Seuil d'alerte stock</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveThreshold} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Produit : <strong>{editingItem.produit_nom}</strong>
              </p>
              <Input
                label="Seuil d'alerte (STOCK FAIBLE)"
                type="number"
                min="0"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => setEditingItem(null)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" fullWidth loading={submitting}>
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
