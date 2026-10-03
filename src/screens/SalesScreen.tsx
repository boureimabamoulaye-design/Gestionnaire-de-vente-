import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, AlertTriangle, CheckCircle2, ShoppingBag, ArrowUp, FileDown } from 'lucide-react';
import { Categorie, Client, Produit, Recu, Sortie } from '../types';
import { formatFCFA, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';
import { pdfService } from '../services/pdfService';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { ProductCombobox } from '../components/ProductCombobox';
import { SearchBar } from '../components/SearchBar';
import { SaleCard } from '../components/SaleCard';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface SalesScreenProps {
  sorties: Sortie[];
  produits: Produit[];
  categories: Categorie[];
  clients?: Client[];
  recus: Recu[];
  onCreateSortie: (payload: {
    produit_id: number;
    categorie_id: number;
    quantite: number;
    prix_unitaire: number;
    client_nom: string;
    client_contact: string;
  }) => Promise<Recu | null>;
  onUpdateSortie?: (
    id: number,
    payload: {
      produit_id: number;
      categorie_id: number;
      quantite: number;
      prix_unitaire: number;
      client_nom: string;
      client_contact: string;
    }
  ) => Promise<Recu | null>;
  onDeleteSortie?: (id: number) => Promise<void>;
  onOpenReceipt: (recu: Recu) => void;
  onNotifyError: (msg: string) => void;
}

export const SalesScreen: React.FC<SalesScreenProps> = ({
  sorties,
  produits,
  categories,
  clients = [],
  recus,
  onCreateSortie,
  onUpdateSortie,
  onDeleteSortie,
  onOpenReceipt,
  onNotifyError,
}) => {
  const { isMasked } = usePrivacyMask();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSortie, setEditingSortie] = useState<Sortie | null>(null);
  const [deletingSortie, setDeletingSortie] = useState<Sortie | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form states
  const [selectedCatId, setSelectedCatId] = useState<number>(0);
  const [selectedProdId, setSelectedProdId] = useState<number>(produits[0]?.id || 0);
  const [quantite, setQuantite] = useState<string>('1');
  const [prixUnitaire, setPrixUnitaire] = useState<string>('');
  const [clientNom, setClientNom] = useState<string>('');
  const [clientContact, setClientContact] = useState<string>('');

  const availableProductsForCat = useMemo(() => {
    if (!selectedCatId || Number(selectedCatId) === 0) return produits;
    return produits.filter((p) => Number(p.categorie_id) === Number(selectedCatId));
  }, [produits, selectedCatId]);

  useEffect(() => {
    if (availableProductsForCat.length > 0) {
      const stillValid = availableProductsForCat.some((p) => Number(p.id) === Number(selectedProdId));
      if (!stillValid) {
        const first = availableProductsForCat[0];
        setSelectedProdId(first.id);
        const preset = first.prix_vente || first.prix_achat || 0;
        setPrixUnitaire(preset > 0 ? String(preset) : '');
      }
    } else {
      setSelectedProdId(0);
    }
  }, [selectedCatId, availableProductsForCat, selectedProdId]);

  const selectedProductObj = useMemo(() => {
    return produits.find((p) => Number(p.id) === Number(selectedProdId)) || null;
  }, [produits, selectedProdId]);

  const handleProductChange = (prodId: number, prod?: Produit) => {
    const found = prod || produits.find((p) => Number(p.id) === Number(prodId));
    if (found && selectedCatId !== 0 && Number(found.categorie_id) !== Number(selectedCatId)) {
      setSelectedCatId(0);
    }
    setSelectedProdId(prodId);
    if (found) {
      const preset = found.prix_vente || found.prix_achat || 0;
      setPrixUnitaire(preset > 0 ? String(preset) : '');
    }
    setFormError('');
  };

  // Calcul automatique : PRIX TOTAL = QUANTITÉ × PRIX UNITAIRE
  const prixTotalCalcule = useMemo(() => {
    const q = Number(quantite);
    const pu = Number(prixUnitaire);
    if (isNaN(q) || q <= 0 || isNaN(pu) || pu < 0) return 0;
    return q * pu;
  }, [quantite, prixUnitaire]);

  // Vérification automatique de la quantité disponible (en tenant compte de la quantité déjà réservée si modification)
  const baseStock = Number(selectedProductObj?.stock_disponible || 0);
  const stockDisponibleActuel =
    editingSortie && Number(editingSortie.produit_id) === Number(selectedProdId)
      ? baseStock + Number(editingSortie.quantite || 0)
      : baseStock;
  const quantiteDemandee = Math.floor(Number(quantite || 0));
  const isStockInsuffisant = quantiteDemandee > stockDisponibleActuel || stockDisponibleActuel <= 0;

  const openModal = () => {
    setEditingSortie(null);
    if (produits.length > 0) {
      const inStockProd = produits.find((p) => p.stock_disponible > 0) || produits[0];
      setSelectedCatId(0);
      setSelectedProdId(inStockProd.id);
      const preset = inStockProd.prix_vente || inStockProd.prix_achat || 0;
      setPrixUnitaire(preset > 0 ? String(preset) : '');
    }
    setQuantite('1');
    setClientNom('');
    setClientContact('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (vente: Sortie) => {
    setEditingSortie(vente);
    setSelectedCatId(0);
    setSelectedProdId(Number(vente.produit_id));
    setQuantite(String(vente.quantite));
    setPrixUnitaire(String(vente.prix_unitaire));
    setClientNom(vente.client_nom || '');
    setClientContact(vente.client_contact || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const qty = Math.floor(Number(quantite));
    const pu = Number(prixUnitaire);

    if (!selectedProdId || isNaN(qty) || qty <= 0) {
      setFormError('Veuillez saisir une quantité valide supérieure à 0.');
      return;
    }

    // Vérification stricte du stock AVANT d'enregistrer ou modifier la vente
    if (qty > stockDisponibleActuel) {
      setFormError('Stock insuffisant');
      onNotifyError('Stock insuffisant.');
      return;
    }

    if (prixUnitaire.trim() === '' || isNaN(pu) || pu < 0) {
      setFormError('Veuillez saisir un prix unitaire de vente valide.');
      return;
    }

    if (!clientNom.trim()) {
      setFormError('Veuillez saisir le nom complet du client.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        produit_id: Number(selectedProdId),
        categorie_id: Number(
          selectedProductObj?.categorie_id || selectedCatId || categories[0]?.id || 1
        ),
        quantite: qty,
        prix_unitaire: pu,
        client_nom: clientNom.trim(),
        client_contact: clientContact.trim(),
      };

      if (editingSortie && onUpdateSortie) {
        const updatedReceipt = await onUpdateSortie(editingSortie.id, payload);
        setIsModalOpen(false);
        setEditingSortie(null);
        if (updatedReceipt) {
          onOpenReceipt(updatedReceipt);
        }
      } else {
        const generatedReceipt = await onCreateSortie(payload);
        setIsModalOpen(false);
        if (generatedReceipt) {
          onOpenReceipt(generatedReceipt);
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Erreur lors de l'enregistrement de la vente.";
      setFormError(msg);
      if (msg.toLowerCase().includes('stock insuffisant')) {
        onNotifyError('Stock insuffisant.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSorties = useMemo(() => {
    return sorties.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (s.produit_nom || '').toLowerCase().includes(q) ||
        s.client_nom.toLowerCase().includes(q) ||
        (s.client_contact || '').toLowerCase().includes(q) ||
        s.numero_recu.toLowerCase().includes(q);
      const matchCat = catFilter === 'ALL' || String(s.categorie_id) === catFilter;
      return matchSearch && matchCat;
    });
  }, [sorties, search, catFilter]);

  const totalMontantVentes = useMemo(() => {
    return filteredSorties.reduce((acc, s) => acc + Number(s.prix_total || 0), 0);
  }, [filteredSorties]);

  const totalQuantiteVendue = useMemo(() => {
    return filteredSorties.reduce((acc, s) => acc + Number(s.quantite || 0), 0);
  }, [filteredSorties]);

  const handleViewReceiptByNumber = (numeroRecu: string) => {
    const found = recus.find((r) => r.numero_recu === numeroRecu);
    if (found) {
      onOpenReceipt(found);
      return;
    }
    const sale = sorties.find((s) => s.numero_recu === numeroRecu);
    if (sale) {
      onOpenReceipt({
        id: sale.id,
        numero_recu: sale.numero_recu,
        type_operation: 'VENTE',
        sortie_id: sale.id,
        date_recu: sale.date_vente,
        partenaire_nom: sale.client_nom,
        partenaire_contact: sale.client_contact || '',
        produit_nom: sale.produit_nom || `Produit #${sale.produit_id}`,
        categorie_nom: sale.categorie_nom || '',
        unite: sale.unite || 'Unité',
        quantite: sale.quantite,
        prix_unitaire: sale.prix_unitaire,
        prix_total: sale.prix_total,
        total_general: sale.prix_total,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSortie || !onDeleteSortie) return;
    setSubmitting(true);
    try {
      await onDeleteSortie(deletingSortie.id);
      setDeletingSortie(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête de la page Ventes parfaitement aligné */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Ventes</h1>
          <p className="text-xs text-slate-500 truncate">
            Sorties de stock et reçus clients
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pdfService.exportSalesToPDF(filteredSorties)}
            icon={<FileDown className="w-4 h-4 text-[#047857]" />}
          >
            Exporter PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Nouvelle vente
          </Button>
        </div>
      </div>

      {/* Résumé rapide des ventes (Empilé sur mobile, 3 colonnes alignées sur PC) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl divide-y md:divide-y-0 md:divide-x divide-slate-100 md:grid md:grid-cols-3 overflow-hidden">
        <div className="px-4 py-3 bg-[#ECFDF5]/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-4 h-4 text-[#047857] shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-[#065F46] truncate">
              Total des ventes
            </span>
          </div>
          <span className="text-sm sm:text-base font-mono font-bold text-[#047857] tabular-nums shrink-0">
            {formatSensitiveFCFA(totalMontantVentes, isMasked)}
          </span>
        </div>
        <div className="grid grid-cols-2 md:col-span-2 divide-x divide-slate-100 text-xs sm:text-sm">
          <div className="px-4 py-2.5 md:py-3 flex items-center justify-between gap-2">
            <span className="text-slate-500 truncate">Nombre de ventes</span>
            <strong className="font-mono text-slate-900 tabular-nums shrink-0">
              {formatNumber(filteredSorties.length)}
            </strong>
          </div>
          <div className="px-4 py-2.5 md:py-3 flex items-center justify-between gap-2">
            <span className="text-slate-500 truncate">Quantité vendue</span>
            <strong className="font-mono text-slate-900 tabular-nums shrink-0">
              {formatNumber(totalQuantiteVendue)}
            </strong>
          </div>
        </div>
      </div>

      {/* Recherche & Filtres par catégorie */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par produit, nom du client, téléphone ou N° reçu..."
        />

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(catFilter === String(c.id) ? 'ALL' : String(c.id))}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  catFilter === String(c.id)
                    ? 'bg-[#047857] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {c.nom}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Liste des ventes */}
      {filteredSorties.length === 0 ? (
        <EmptyState
          title="Aucune vente enregistrée"
          description="Appuyez sur Nouvelle vente pour enregistrer une sortie de stock et générer son reçu."
          actionLabel="Nouvelle vente"
          onAction={openModal}
        />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 overflow-hidden">
          <div className="lg:hidden px-3.5 py-2 sm:px-4 bg-slate-50/80 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>VENTES ({filteredSorties.length})</span>
            <span>MONTANT & REÇU</span>
          </div>
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 px-4 py-2.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
            <span className="col-span-3">PRODUIT & N° REÇU ({filteredSorties.length})</span>
            <span className="col-span-3">CLIENT & CONTACT</span>
            <span className="col-span-2">DATE</span>
            <span className="col-span-1 text-right">QUANTITÉ</span>
            <span className="col-span-1 text-right">TOTAL</span>
            <span className="col-span-2 text-right">ACTIONS</span>
          </div>
          {filteredSorties.map((vente) => (
            <SaleCard
              key={vente.id}
              vente={vente}
              onViewReceipt={handleViewReceiptByNumber}
              onEdit={onUpdateSortie ? (v) => openEditModal(v) : undefined}
              onDelete={onDeleteSortie ? (v) => setDeletingSortie(v) : undefined}
            />
          ))}
          {filteredSorties.length > 3 && (
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

      {/* Modale Web : Enregistrer une vente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingSortie ? 'Modifier la vente' : 'Enregistrer une vente'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingSortie(null);
                }}
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs font-bold text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {produits.length === 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
                  Aucun produit n'est encore enregistré. Ajoutez d'abord un produit dans l'onglet{' '}
                  <strong>Produits</strong> avant d'enregistrer une vente.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Select
                  label="Catégorie *"
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(Number(e.target.value))}
                  options={[
                    { value: 0, label: 'Toutes les catégories' },
                    ...categories.map((c) => ({ value: c.id, label: c.nom })),
                  ]}
                />
                <ProductCombobox
                  label="Produit *"
                  produits={availableProductsForCat}
                  allProduits={produits}
                  value={selectedProdId}
                  onChange={(prodId, prod) => handleProductChange(prodId, prod)}
                  mode="sale"
                  placeholder="Saisir ou choisir un produit..."
                />
              </div>

              {/* Vérification en direct du stock disponible */}
              {selectedProductObj && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isStockInsuffisant
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isStockInsuffisant ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" />
                    )}
                    <span className="truncate">
                      Stock disponible :{' '}
                      <strong className="font-mono">
                        {formatNumber(stockDisponibleActuel)} {selectedProductObj.unite}
                      </strong>
                    </span>
                  </div>
                  {isStockInsuffisant ? (
                    <span className="font-bold text-red-600 shrink-0">Stock insuffisant</span>
                  ) : (
                    <span className="font-mono text-slate-500 shrink-0">
                      Après vente : {formatNumber(stockDisponibleActuel - quantiteDemandee)}
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <Input
                  label="Quantité *"
                  type="number"
                  min="1"
                  step="1"
                  value={quantite}
                  onChange={(e) => {
                    setQuantite(e.target.value);
                    setFormError('');
                  }}
                  error={isStockInsuffisant ? 'Stock insuffisant' : undefined}
                  required
                />
                <Input
                  label="Prix unitaire *"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Ex: 2500"
                  value={prixUnitaire}
                  onChange={(e) => setPrixUnitaire(e.target.value)}
                  rightAddon="FCFA"
                  required
                />
              </div>

              {/* Calcul automatique : PRIX TOTAL = QUANTITÉ × PRIX UNITAIRE */}
              <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between">
                <span className="text-xs font-bold text-[#065F46]">
                  PRIX TOTAL ({formatNumber(quantite)} × {formatFCFA(prixUnitaire)})
                </span>
                <span className="text-base sm:text-lg font-mono font-bold text-[#047857] tabular-nums">
                  {formatFCFA(prixTotalCalcule)}
                </span>
              </div>

              {/* Saisie directe du Client et de son Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <Input
                    label="Nom complet du client *"
                    list="sales-clients-list"
                    placeholder="Saisir le nom complet du client"
                    value={clientNom}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClientNom(val);
                      const matched = clients.find(
                        (c) => c.nom_complet.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (matched && matched.telephone && !clientContact) {
                        setClientContact(matched.telephone);
                      }
                    }}
                    required
                  />
                  <datalist id="sales-clients-list">
                    {clients.map((c) => (
                      <option key={c.id} value={c.nom_complet} />
                    ))}
                  </datalist>
                </div>
                <Input
                  label="Contact du client"
                  placeholder="Ex: +223 75 00 00 00"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingSortie(null);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={submitting}
                  disabled={isStockInsuffisant}
                >
                  {isStockInsuffisant
                    ? 'Stock insuffisant'
                    : editingSortie
                    ? 'Enregistrer'
                    : 'Valider la vente'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deletingSortie}
        title="Supprimer la vente"
        message={`Confirmez-vous la suppression de la vente "${deletingSortie?.produit_nom}" (${deletingSortie?.numero_recu}) ? Le stock sera automatiquement réajusté.`}
        confirmLabel="Supprimer"
        loading={submitting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingSortie(null)}
      />
    </div>
  );
};
