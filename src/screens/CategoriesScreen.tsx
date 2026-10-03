import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, CheckCircle2, Tags } from 'lucide-react';
import { Categorie } from '../types';
import { formatDateShort, formatNumber } from '../utils/formatters';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface CategoriesScreenProps {
  categories: Categorie[];
  onCreate: (payload: Partial<Categorie>) => Promise<void>;
  onUpdate: (id: number, payload: Partial<Categorie>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  categories,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Categorie | null>(null);
  const [deletingCat, setDeletingCat] = useState<Categorie | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [statut, setStatut] = useState<'Actif' | 'Inactif'>('Actif');
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.nom.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
    );
  }, [categories, search]);

  const openAdd = () => {
    setEditingCat(null);
    setNom('');
    setDescription('');
    setStatut('Actif');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (cat: Categorie) => {
    setEditingCat(cat);
    setNom(cat.nom);
    setDescription(cat.description || '');
    setStatut(cat.statut || 'Actif');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!nom.trim()) {
      setFormError('Le nom de la catégorie est obligatoire.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingCat) {
        await onUpdate(editingCat.id, { nom: nom.trim(), description: description.trim(), statut });
      } else {
        await onCreate({ nom: nom.trim(), description: description.trim(), statut });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCat) return;
    setSubmitting(true);
    try {
      await onDelete(deletingCat.id);
      setDeletingCat(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Catégories</h1>
          <p className="text-xs text-slate-500 truncate">
            {formatNumber(filtered.length)} catégorie(s) disponible(s)
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openAdd} icon={<Plus className="w-4 h-4" />}>
          Ajouter
        </Button>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une catégorie par nom ou description..."
        />
      </div>

      {/* Unified Compact Categories List */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Aucune catégorie trouvée"
          description="Créez des catégories pour classer vos produits."
          actionLabel="Nouvelle catégorie"
          onAction={openAdd}
        />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 px-4 py-2.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
            <span className="col-span-3">CATÉGORIE ({filtered.length})</span>
            <span className="col-span-4">DESCRIPTION</span>
            <span className="col-span-2 text-right">PRODUITS LIÉS</span>
            <span className="col-span-1 text-center">STATUT</span>
            <span className="col-span-2 text-right">ACTIONS</span>
          </div>
          {filtered.map((cat) => (
            <div
              key={cat.id}
              className="px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 transition-colors"
            >
              {/* Version Mobile & Tablette (< lg) */}
              <div className="lg:hidden flex items-center justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {cat.nom}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">#{cat.id}</span>
                    <span className="text-[11px] font-mono font-semibold text-[#047857] shrink-0">
                      · {formatNumber(cat.nombre_produits || 0)} prod.
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {cat.description || 'Aucune description'} · {cat.statut} · {formatDateShort(cat.date_creation)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="h-7 px-2 rounded-lg text-[11px] font-medium text-[#047857] bg-[#ECFDF5] hover:bg-[#D1FAE5] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Modifier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingCat(cat)}
                    aria-label={`Supprimer ${cat.nom}`}
                    className="h-7 w-7 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Version PC / Desktop (>= lg) */}
              <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
                <div className="col-span-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">{cat.nom}</p>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">#{cat.id}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    Créée le {formatDateShort(cat.date_creation)}
                  </p>
                </div>
                <div className="col-span-4 text-xs text-slate-600 truncate">
                  {cat.description || 'Aucune description'}
                </div>
                <div className="col-span-2 text-right font-mono text-xs font-semibold text-[#047857] tabular-nums">
                  {formatNumber(cat.nombre_produits || 0)} produit(s)
                </div>
                <div className="col-span-1 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                      cat.statut === 'Actif'
                        ? 'bg-emerald-50 text-[#047857]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.statut}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="h-8 px-2.5 rounded-lg text-xs font-semibold text-[#065F46] bg-[#ECFDF5] hover:bg-[#D1FAE5] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Modifier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingCat(cat)}
                    aria-label={`Supprimer ${cat.nom}`}
                    className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingCat ? `Modifier la catégorie #${editingCat.id}` : 'Ajouter une catégorie'}
              </h2>
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

              <Input
                label="Nom de la catégorie *"
                placeholder="Ex: Volailles, Poussins, Œufs, Aliments..."
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description des produits de cette catégorie..."
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#047857]"
                />
              </div>

              <Select
                label="Statut"
                value={statut}
                onChange={(e) => setStatut(e.target.value as 'Actif' | 'Inactif')}
                options={[
                  { value: 'Actif', label: 'Actif' },
                  { value: 'Inactif', label: 'Inactif' },
                ]}
              />

              <div className="pt-3 grid grid-cols-2 gap-2.5">
                <Button type="button" variant="outline" fullWidth onClick={() => setIsModalOpen(false)}>
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

      <ConfirmationModal
        isOpen={!!deletingCat}
        title="Supprimer la catégorie"
        message={`Confirmez-vous la suppression de la catégorie "${deletingCat?.nom}" ?`}
        confirmLabel="Supprimer"
        loading={submitting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingCat(null)}
      />
    </div>
  );
};
