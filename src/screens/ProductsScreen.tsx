import React, { useMemo, useState } from 'react';
import { Plus, X, ArrowUp } from 'lucide-react';
import { Categorie, Entree, Produit, Sortie } from '../types';
import { formatDateTime, formatFCFA, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { SearchBar } from '../components/SearchBar';
import { ProductCard } from '../components/ProductCard';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ProductsScreenProps {
  produits: Produit[];
  categories: Categorie[];
  entrees: Entree[];
  sorties: Sortie[];
  onCreate: (payload: Partial<Produit> & { stock_initial?: number }) => Promise<void>;
  onUpdate: (id: number, payload: Partial<Produit>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const UNITES_COURANTES = [
  'Unité',
  'Sujet',
  'Poussin',
  'Plateau',
  'Sac 50kg',
  'Sac 25kg',
  'Kg',
  'Carton',
  'Flacon 1L',
  'Bidon 5L',
];

export const ProductsScreen: React.FC<ProductsScreenProps> = ({
  produits,
  categories,
  entrees,
  sorties,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const { isMasked } = usePrivacyMask();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produit | null>(null);
  const [detailProduct, setDetailProduct] = useState<Produit | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Produit | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [nom, setNom] = useState('');
  const [categorieId, setCategorieId] = useState<number>(categories[0]?.id || 1);
  const [unite, setUnite] = useState('Unité');
  const [seuilAlerte, setSeuilAlerte] = useState('10');
  const [statut, setStatut] = useState<'Actif' | 'Inactif'>('Actif');
  const [stockInitial, setStockInitial] = useState('0');
  const [formError, setFormError] = useState('');

  const filteredProducts = useMemo(() => {
    return produits.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.nom.toLowerCase().includes(q) ||
        (p.categorie_nom || '').toLowerCase().includes(q) ||
        p.unite.toLowerCase().includes(q);
      const matchCat = selectedCat === 'ALL' || String(p.categorie_id) === selectedCat;
      const matchStatus = selectedStatus === 'ALL' || p.stock_statut === selectedStatus;
      return matchSearch && matchCat && matchStatus;
    });
  }, [produits, search, selectedCat, selectedStatus]);

  const openAddModal = () => {
    setEditingProduct(null);
    setNom('');
    setCategorieId(categories[0]?.id || 1);
    setUnite('Unité');
    setSeuilAlerte('10');
    setStatut('Actif');
    setStockInitial('0');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (prod: Produit) => {
    setEditingProduct(prod);
    setNom(prod.nom);
    setCategorieId(prod.categorie_id);
    setUnite(prod.unite);
    setSeuilAlerte(String(prod.seuil_alerte));
    setStatut(prod.statut);
    setStockInitial('0');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!nom.trim()) {
      setFormError('Veuillez saisir le nom du produit.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        await onUpdate(editingProduct.id, {
          nom: nom.trim(),
          categorie_id: Number(categorieId),
          prix_achat: Number(editingProduct.prix_achat || 0),
          prix_vente: Number(editingProduct.prix_vente || 0),
          unite: unite.trim() || 'Unité',
          seuil_alerte: Number(seuilAlerte || 10),
          statut,
        });
      } else {
        await onCreate({
          nom: nom.trim(),
          categorie_id: Number(categorieId),
          prix_achat: 0,
          prix_vente: 0,
          unite: unite.trim() || 'Unité',
          seuil_alerte: Number(seuilAlerte || 10),
          statut,
          stock_initial: Math.max(0, Math.floor(Number(stockInitial || 0))),
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setSubmitting(true);
    try {
      await onDelete(deletingProduct.id);
      setDeletingProduct(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Produits</h1>
          <p className="text-xs text-slate-500 truncate">
            {formatNumber(filteredProducts.length)} référence(s) affichée(s)
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openAddModal} icon={<Plus className="w-4 h-4" />}>
          Ajouter
        </Button>
      </div>

      {/* Search & Interactive Filter Controls */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 sm:p-3.5 space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div className="md:col-span-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Rechercher un produit par nom, catégorie ou unité..."
            />
          </div>
          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: 'ALL', label: 'Tous les états de stock' },
              { value: 'EN STOCK', label: 'EN STOCK' },
              { value: 'STOCK FAIBLE', label: 'STOCK FAIBLE' },
              { value: 'RUPTURE', label: 'RUPTURE' },
            ]}
          />
        </div>

        {/* Category Segmented Interactive Filter Buttons */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCat(selectedCat === String(cat.id) ? 'ALL' : String(cat.id))}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCat === String(cat.id)
                    ? 'bg-[#047857] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.nom}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Unified Product List */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          title="Aucun produit trouvé"
          description="Ajoutez un nouveau produit ou modifiez vos critères de recherche."
          actionLabel="Ajouter un produit"
          onAction={openAddModal}
        />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 overflow-hidden">
          <div className="lg:hidden px-3.5 py-2 sm:px-4 bg-slate-50/80 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>PRODUITS ({filteredProducts.length})</span>
            <span>STOCK & ACTIONS</span>
          </div>
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 px-4 py-2.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
            <span className="col-span-4">PRODUIT ({filteredProducts.length})</span>
            <span className="col-span-2">CATÉGORIE</span>
            <span className="col-span-2">UNITÉ</span>
            <span className="col-span-1 text-right">SEUIL</span>
            <span className="col-span-2 text-right">STOCK & STATUT</span>
            <span className="col-span-1 text-right">ACTIONS</span>
          </div>
          {filteredProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              produit={prod}
              onView={setDetailProduct}
              onEdit={openEditModal}
              onDelete={setDeletingProduct}
            />
          ))}
          {filteredProducts.length > 3 && (
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

      {/* Add / Edit Web Dialog Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingProduct ? 'Modifier le produit' : 'Ajouter un nouveau produit'}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}

              <Input
                label="Nom du produit *"
                placeholder="Ex: Aliment Démarrage Volaille 50kg"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Select
                  label="Catégorie *"
                  value={categorieId}
                  onChange={(e) => setCategorieId(Number(e.target.value))}
                  options={
                    categories.length > 0
                      ? categories.map((c) => ({ value: c.id, label: c.nom }))
                      : [{ value: 0, label: 'Général (Automatique)' }]
                  }
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Unité *</label>
                  <input
                    list="unites-list"
                    value={unite}
                    onChange={(e) => setUnite(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#047857]"
                    placeholder="Ex: Unité, Sac 50kg, Plateau"
                  />
                  <datalist id="unites-list">
                    {UNITES_COURANTES.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <Input
                  label="Seuil d'alerte"
                  type="number"
                  min="0"
                  value={seuilAlerte}
                  onChange={(e) => setSeuilAlerte(e.target.value)}
                />
                <Select
                  label="Statut"
                  value={statut}
                  onChange={(e) => setStatut(e.target.value as 'Actif' | 'Inactif')}
                  options={[
                    { value: 'Actif', label: 'Actif' },
                    { value: 'Inactif', label: 'Inactif' },
                  ]}
                />
              </div>

              {!editingProduct && (
                <Input
                  label="Stock initial (optionnel)"
                  type="number"
                  min="0"
                  value={stockInitial}
                  onChange={(e) => setStockInitial(e.target.value)}
                />
              )}

              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5">
                <Button type="button" variant="outline" fullWidth onClick={() => setIsFormOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" variant="primary" fullWidth loading={submitting}>
                  {editingProduct ? 'Enregistrer' : 'Ajouter'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Details Web Dialog Modal */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">{detailProduct.nom}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catégorie : {detailProduct.categorie_nom} · Unité : {detailProduct.unite} · Statut :{' '}
                  {detailProduct.statut}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aligned List of Product Attributes */}
            <div className="my-4 bg-slate-50 border border-slate-200/80 rounded-2xl divide-y divide-slate-200/60 text-xs">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Stock disponible actuel</span>
                <span className="font-mono font-bold text-[#047857] tabular-nums">
                  {formatNumber(detailProduct.stock_disponible)} {detailProduct.unite} ({detailProduct.stock_statut})
                </span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Seuil d'alerte</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {formatNumber(detailProduct.seuil_alerte)} {detailProduct.unite}
                </span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Cumul Entrées / Sorties</span>
                <span className="font-mono text-slate-700 tabular-nums">
                  +{formatNumber(detailProduct.total_entrees || 0)} / -{formatNumber(detailProduct.total_sorties || 0)}
                </span>
              </div>
            </div>

            {/* Recent product movements list */}
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-700 mb-2">Historique des mouvements récents</h3>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200/80 rounded-xl bg-white">
                {[
                  ...entrees
                    .filter((e) => Number(e.produit_id) === Number(detailProduct.id))
                    .map((e) => ({
                      id: `e_${e.id}`,
                      type: 'ENTRÉE',
                      qte: `+${e.quantite}`,
                      partenaire: e.fournisseur_nom,
                      montant: e.prix_total,
                      date: e.date_achat,
                    })),
                  ...sorties
                    .filter((s) => Number(s.produit_id) === Number(detailProduct.id))
                    .map((s) => ({
                      id: `s_${s.id}`,
                      type: 'VENTE',
                      qte: `-${s.quantite}`,
                      partenaire: s.client_nom,
                      montant: s.prix_total,
                      date: s.date_vente,
                    })),
                ]
                  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                  .slice(0, 8)
                  .map((m) => (
                    <div key={m.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1">
                        <span
                          className={`font-semibold ${
                            m.type === 'VENTE' ? 'text-[#047857]' : 'text-slate-800'
                          }`}
                        >
                          {m.type} ({m.qte})
                        </span>
                        <span className="text-slate-500"> · {m.partenaire}</span>
                        <p className="text-[11px] text-slate-400">{formatDateTime(m.date)}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                        {formatSensitiveFCFA(m.montant, isMasked)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="mt-5">
              <Button variant="primary" fullWidth onClick={() => setDetailProduct(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deletingProduct}
        title="Supprimer le produit"
        message={`Voulez-vous vraiment supprimer "${deletingProduct?.nom}" ? Cette action supprimera également sa ligne de stock.`}
        confirmLabel="Supprimer"
        loading={submitting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingProduct(null)}
      />
    </div>
  );
};
