import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, ArrowDownLeft, ArrowUp } from 'lucide-react';
import { Categorie, Entree, Fournisseur, Produit, Recu } from '../types';
import { formatFCFA, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { ProductCombobox } from '../components/ProductCombobox';
import { SearchBar } from '../components/SearchBar';
import { EntryCard } from '../components/EntryCard';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface EntriesScreenProps {
  entrees: Entree[];
  produits: Produit[];
  categories: Categorie[];
  fournisseurs?: Fournisseur[];
  recus: Recu[];
  onCreateEntree: (payload: {
    produit_id: number;
    produit_nom?: string;
    categorie_id: number;
    quantite: number;
    prix_unitaire: number;
    fournisseur_nom: string;
    fournisseur_contact: string;
  }) => Promise<Recu | null>;
  onDeleteEntree?: (id: number) => Promise<void>;
  onOpenReceipt: (recu: Recu) => void;
}

export const EntriesScreen: React.FC<EntriesScreenProps> = ({
  entrees,
  produits,
  categories,
  fournisseurs = [],
  recus,
  onCreateEntree,
  onDeleteEntree,
  onOpenReceipt,
}) => {
  const { isMasked } = usePrivacyMask();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingEntree, setDeletingEntree] = useState<Entree | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form states
  const [selectedCatId, setSelectedCatId] = useState<number>(0);
  const [selectedProdId, setSelectedProdId] = useState<number>(produits[0]?.id || 0);
  const [customProductName, setCustomProductName] = useState<string>('');
  const [quantite, setQuantite] = useState<string>('100');
  const [prixUnitaire, setPrixUnitaire] = useState<string>('500');
  const [fournisseurNom, setFournisseurNom] = useState<string>('');
  const [fournisseurContact, setFournisseurContact] = useState<string>('');

  const availableProductsForCat = useMemo(() => {
    if (!selectedCatId || Number(selectedCatId) === 0) return produits;
    return produits.filter((p) => Number(p.categorie_id) === Number(selectedCatId));
  }, [produits, selectedCatId]);

  useEffect(() => {
    if (customProductName.trim() !== '') return;
    if (availableProductsForCat.length > 0) {
      const stillValid = availableProductsForCat.some((p) => Number(p.id) === Number(selectedProdId));
      if (!stillValid) {
        const first = availableProductsForCat[0];
        setSelectedProdId(first.id);
        setPrixUnitaire(first.prix_achat > 0 ? String(first.prix_achat) : '');
      }
    } else {
      setSelectedProdId(0);
    }
  }, [selectedCatId, availableProductsForCat, selectedProdId, customProductName]);

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
      setPrixUnitaire(found.prix_achat > 0 ? String(found.prix_achat) : '');
    }
  };

  // Calcul automatique : PRIX TOTAL = QUANTITÉ × PRIX UNITAIRE
  const prixTotalCalcule = useMemo(() => {
    const q = Number(quantite);
    const pu = Number(prixUnitaire);
    if (isNaN(q) || q <= 0 || isNaN(pu) || pu < 0) return 0;
    return q * pu;
  }, [quantite, prixUnitaire]);

  const openModal = () => {
    if (produits.length > 0) {
      const first = produits[0];
      setSelectedCatId(0);
      setSelectedProdId(first.id);
      setPrixUnitaire(first.prix_achat > 0 ? String(first.prix_achat) : '');
    } else {
      setSelectedCatId(categories[0]?.id || 1);
      setSelectedProdId(0);
      setPrixUnitaire('');
    }
    setCustomProductName('');
    setQuantite('10');
    setFournisseurNom('');
    setFournisseurContact('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const qty = Math.floor(Number(quantite));
    const pu = Number(prixUnitaire);
    if ((!selectedProdId && !customProductName.trim()) || isNaN(qty) || qty <= 0) {
      setFormError('Veuillez choisir ou saisir un produit et une quantité supérieure à 0.');
      return;
    }
    if (prixUnitaire.trim() === '' || isNaN(pu) || pu < 0) {
      setFormError("Veuillez saisir un prix unitaire d'achat valide.");
      return;
    }
    if (!fournisseurNom.trim()) {
      setFormError('Veuillez saisir le nom complet du fournisseur.');
      return;
    }

    setSubmitting(true);
    try {
      const generatedReceipt = await onCreateEntree({
        produit_id: Number(selectedProdId || 0),
        produit_nom: customProductName.trim() || selectedProductObj?.nom || undefined,
        categorie_id: Number(selectedProductObj?.categorie_id || selectedCatId || categories[0]?.id || 1),
        quantite: qty,
        prix_unitaire: pu,
        fournisseur_nom: fournisseurNom.trim(),
        fournisseur_contact: fournisseurContact.trim(),
      });
      setIsModalOpen(false);
      if (generatedReceipt) {
        onOpenReceipt(generatedReceipt);
      }
    } catch (err: any) {
      setFormError(err?.message || "Erreur lors de l'enregistrement de l'entrée.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEntrees = useMemo(() => {
    return entrees.filter((e) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (e.produit_nom || '').toLowerCase().includes(q) ||
        e.fournisseur_nom.toLowerCase().includes(q) ||
        (e.fournisseur_contact || '').toLowerCase().includes(q) ||
        e.numero_recu.toLowerCase().includes(q);
      const matchCat = catFilter === 'ALL' || String(e.categorie_id) === catFilter;
      return matchSearch && matchCat;
    });
  }, [entrees, search, catFilter]);

  const totalMontantEntrees = useMemo(() => {
    return filteredEntrees.reduce((acc, e) => acc + Number(e.prix_total || 0), 0);
  }, [filteredEntrees]);

  const totalQuantiteEntrees = useMemo(() => {
    return filteredEntrees.reduce((acc, e) => acc + Number(e.quantite || 0), 0);
  }, [filteredEntrees]);

  const handleViewReceipt = (numeroRecu: string) => {
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

  const handleConfirmDelete = async () => {
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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Entrées / Achats</h1>
          <p className="text-xs text-slate-500 truncate">
            Approvisionnements et mise à jour du stock
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={openModal}
          icon={<Plus className="w-4 h-4" />}
        >
          Nouvelle entrée
        </Button>
      </div>

      {/* Résumé rapide des entrées (Empilé sur mobile, 3 colonnes alignées sur PC) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl divide-y md:divide-y-0 md:divide-x divide-slate-100 md:grid md:grid-cols-3 overflow-hidden">
        <div className="px-4 py-3 bg-[#ECFDF5]/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowDownLeft className="w-4 h-4 text-[#047857] shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-[#065F46] truncate">
              Total des achats
            </span>
          </div>
          <span className="text-sm sm:text-base font-mono font-bold text-slate-900 tabular-nums shrink-0">
            {formatSensitiveFCFA(totalMontantEntrees, isMasked)}
          </span>
        </div>
        <div className="grid grid-cols-2 md:col-span-2 divide-x divide-slate-100 text-xs sm:text-sm">
          <div className="px-4 py-2.5 md:py-3 flex items-center justify-between gap-2">
            <span className="text-slate-500 truncate">Nombre d'entrées</span>
            <strong className="font-mono text-slate-900 tabular-nums shrink-0">
              {formatNumber(filteredEntrees.length)}
            </strong>
          </div>
          <div className="px-4 py-2.5 md:py-3 flex items-center justify-between gap-2">
            <span className="text-slate-500 truncate">Quantité entrée</span>
            <strong className="font-mono text-[#047857] tabular-nums shrink-0">
              +{formatNumber(totalQuantiteEntrees)}
            </strong>
          </div>
        </div>
      </div>

      {/* Recherche & Filtres */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par produit, fournisseur, téléphone ou reçu..."
        />

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setCatFilter('ALL')}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              catFilter === 'ALL'
                ? 'bg-[#047857] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Toutes ({entrees.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatFilter(String(c.id))}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                catFilter === String(c.id)
                  ? 'bg-[#047857] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c.nom}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des entrées alignée */}
      {filteredEntrees.length === 0 ? (
        <EmptyState
          title="Aucune entrée enregistrée"
          description="Enregistrez vos achats fournisseurs pour augmenter automatiquement votre stock."
          actionLabel="Nouvelle entrée"
          onAction={openModal}
        />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 overflow-hidden">
          <div className="lg:hidden px-3.5 py-2 sm:px-4 bg-slate-50/80 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>ACHATS / ENTRÉES ({filteredEntrees.length})</span>
            <span>MONTANT & REÇU</span>
          </div>
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 px-4 py-2.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
            <span className="col-span-3">PRODUIT & N° REÇU ({filteredEntrees.length})</span>
            <span className="col-span-3">FOURNISSEUR & CONTACT</span>
            <span className="col-span-2">DATE</span>
            <span className="col-span-1 text-right">QUANTITÉ</span>
            <span className="col-span-2 text-right">MONTANT TOTAL</span>
            <span className="col-span-1 text-right">ACTIONS</span>
          </div>
          {filteredEntrees.map((entree) => (
            <EntryCard
              key={entree.id}
              entree={entree}
              onViewReceipt={handleViewReceipt}
              onDelete={onDeleteEntree ? (e) => setDeletingEntree(e) : undefined}
            />
          ))}
          {filteredEntrees.length > 3 && (
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

      {/* Modale Web : Enregistrer une entrée */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Enregistrer une entrée (Achat)</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Select
                  label="Catégorie"
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
                  customName={customProductName}
                  onCustomNameChange={setCustomProductName}
                  mode="entry"
                  placeholder="Saisir ou choisir un produit..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantité *"
                  type="number"
                  min="1"
                  step="1"
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  required
                />
                <Input
                  label="Prix unitaire *"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Ex: 1500"
                  value={prixUnitaire}
                  onChange={(e) => setPrixUnitaire(e.target.value)}
                  rightAddon="FCFA"
                  required
                />
              </div>

              {/* Calcul automatique : PRIX TOTAL = QUANTITÉ × PRIX UNITAIRE */}
              <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#065F46] block">
                    PRIX TOTAL (Quantité × Prix unitaire)
                  </span>
                  <span className="text-[11px] font-mono text-[#047857]">
                    {formatNumber(quantite)} × {formatFCFA(prixUnitaire)}
                  </span>
                </div>
                <span className="text-base sm:text-lg font-mono font-bold text-[#047857] tabular-nums">
                  {formatFCFA(prixTotalCalcule)}
                </span>
              </div>

              {/* Saisie directe du Fournisseur et de son Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <Input
                    label="Nom complet du fournisseur *"
                    list="entries-suppliers-list"
                    placeholder="Saisir le nom du fournisseur"
                    value={fournisseurNom}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFournisseurNom(val);
                      const matched = fournisseurs.find(
                        (f) => f.nom_complet.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (matched && matched.telephone && !fournisseurContact) {
                        setFournisseurContact(matched.telephone);
                      }
                    }}
                    required
                  />
                  <datalist id="entries-suppliers-list">
                    {fournisseurs.map((f) => (
                      <option key={f.id} value={f.nom_complet} />
                    ))}
                  </datalist>
                </div>
                <Input
                  label="Contact du fournisseur"
                  placeholder="Ex: +223 76 00 00 00"
                  value={fournisseurContact}
                  onChange={(e) => setFournisseurContact(e.target.value)}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5">
                <Button type="button" variant="outline" fullWidth onClick={() => setIsModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" variant="primary" fullWidth loading={submitting}>
                  Valider (+{formatNumber(quantite)})
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deletingEntree}
        title="Supprimer l'entrée"
        message={`Confirmez-vous la suppression de l'entrée "${deletingEntree?.produit_nom}" (${deletingEntree?.numero_recu}) ? Le stock sera automatiquement recalculé.`}
        confirmLabel="Supprimer"
        loading={submitting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingEntree(null)}
      />
    </div>
  );
};
