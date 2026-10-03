import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, History, X, Truck } from 'lucide-react';
import { Entree, Fournisseur } from '../types';
import { apiClient } from '../api/client';
import { formatDateShort, formatDateTime, formatFCFA, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface SuppliersScreenProps {
  fournisseurs: Fournisseur[];
  onCreate: (payload: Partial<Fournisseur>) => Promise<void>;
  onUpdate: (id: number, payload: Partial<Fournisseur>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({
  fournisseurs,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const { isMasked } = usePrivacyMask();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupp, setEditingSupp] = useState<Fournisseur | null>(null);
  const [deletingSupp, setDeletingSupp] = useState<Fournisseur | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [historySupp, setHistorySupp] = useState<Fournisseur | null>(null);
  const [suppPurchases, setSuppPurchases] = useState<Entree[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [nomComplet, setNomComplet] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fournisseurs;
    return fournisseurs.filter(
      (f) =>
        f.nom_complet.toLowerCase().includes(q) ||
        (f.telephone || '').toLowerCase().includes(q) ||
        (f.adresse || '').toLowerCase().includes(q) ||
        (f.email || '').toLowerCase().includes(q)
    );
  }, [fournisseurs, search]);

  const openAdd = () => {
    setEditingSupp(null);
    setNomComplet('');
    setTelephone('');
    setAdresse('');
    setEmail('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (f: Fournisseur) => {
    setEditingSupp(f);
    setNomComplet(f.nom_complet);
    setTelephone(f.telephone || '');
    setAdresse(f.adresse || '');
    setEmail(f.email || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const openHistory = async (f: Fournisseur) => {
    setHistorySupp(f);
    setLoadingHistory(true);
    try {
      const res = await apiClient.getFournisseurHistory(f.id);
      setSuppPurchases(res.achats || []);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!nomComplet.trim()) {
      setFormError('Le nom complet du fournisseur est obligatoire.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingSupp) {
        await onUpdate(editingSupp.id, {
          nom_complet: nomComplet.trim(),
          telephone: telephone.trim(),
          adresse: adresse.trim(),
          email: email.trim(),
        });
      } else {
        await onCreate({
          nom_complet: nomComplet.trim(),
          telephone: telephone.trim(),
          adresse: adresse.trim(),
          email: email.trim(),
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSupp) return;
    setSubmitting(true);
    try {
      await onDelete(deletingSupp.id);
      setDeletingSupp(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Fournisseurs</h1>
          <p className="text-xs text-slate-500 truncate">
            {formatNumber(filtered.length)} fournisseur(s) enregistré(s)
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
          placeholder="Rechercher un fournisseur par nom, téléphone, adresse..."
        />
      </div>

      {/* Unified Compact Suppliers List */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Aucun fournisseur trouvé"
          description="Enregistrez vos fournisseurs pour suivre vos achats et entrées de stock."
          actionLabel="Ajouter un fournisseur"
          onAction={openAdd}
        />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 px-4 py-2.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
            <span className="col-span-3">FOURNISSEUR ({filtered.length})</span>
            <span className="col-span-2">TÉLÉPHONE</span>
            <span className="col-span-2">ADRESSE</span>
            <span className="col-span-1 text-right">ACHATS</span>
            <span className="col-span-2 text-right">MONTANT TOTAL</span>
            <span className="col-span-2 text-right">ACTIONS</span>
          </div>
          {filtered.map((fournisseur) => (
            <div
              key={fournisseur.id}
              className="px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 transition-colors"
            >
              {/* Version Mobile & Tablette (< lg) */}
              <div className="lg:hidden">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {fournisseur.nom_complet}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      · {fournisseur.telephone || 'Sans tél.'}
                    </span>
                  </div>

                  <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums shrink-0">
                    {formatSensitiveFCFA(fournisseur.montant_total || 0, isMasked)}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
                    <span className="font-mono font-semibold text-[#047857] shrink-0">
                      {formatNumber(fournisseur.nombre_approvisionnements || 0)} achat(s)
                    </span>
                    {fournisseur.adresse && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{fournisseur.adresse}</span>
                      </>
                    )}
                    <span className="hidden sm:inline" aria-hidden="true">·</span>
                    <span className="hidden sm:inline text-slate-400 shrink-0">
                      {formatDateShort(fournisseur.date_ajout)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openHistory(fournisseur)}
                      className="h-7 px-2 rounded-lg bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <History className="w-3 h-3" />
                      <span>Historique</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(fournisseur)}
                      className="h-7 w-7 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSupp(fournisseur)}
                      className="h-7 w-7 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Version PC / Desktop (>= lg) */}
              <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{fournisseur.nom_complet}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    Ajouté le {formatDateShort(fournisseur.date_ajout)}
                  </p>
                </div>
                <div className="col-span-2 font-mono text-xs text-slate-700 truncate">
                  {fournisseur.telephone || 'Sans tél.'}
                </div>
                <div className="col-span-2 text-xs text-slate-600 truncate">
                  {fournisseur.adresse || '—'}
                </div>
                <div className="col-span-1 text-right font-mono text-xs font-semibold text-[#047857] tabular-nums">
                  {formatNumber(fournisseur.nombre_approvisionnements || 0)}
                </div>
                <div className="col-span-2 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {formatSensitiveFCFA(fournisseur.montant_total || 0, isMasked)}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => openHistory(fournisseur)}
                    className="h-8 px-2.5 rounded-lg bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Historique</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(fournisseur)}
                    className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingSupp(fournisseur)}
                    className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Supplier Web Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingSupp ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
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
                label="Nom complet *"
                placeholder="Ex: Couvoir National Avicole"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                required
              />
              <Input
                label="Téléphone *"
                placeholder="Ex: +223 76 45 12 80"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
              <Input
                label="Adresse"
                placeholder="Ex: Zone Industrielle, Bamako"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
              />
              <Input
                label="Email"
                type="email"
                placeholder="Ex: contact@couvoir.ml"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

      {/* Supplier Purchase History Web Modal */}
      {historySupp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  Historique des achats — {historySupp.nom_complet}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tél : {historySupp.telephone || '-'} · Adresse : {historySupp.adresse || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistorySupp(null)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200/80 rounded-xl">
              {loadingHistory ? (
                <p className="py-8 text-center text-xs text-slate-500">Chargement de l'historique...</p>
              ) : suppPurchases.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Aucun achat enregistré auprès de ce fournisseur.
                </p>
              ) : (
                suppPurchases.map((e) => (
                  <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {e.produit_nom} (+{formatNumber(e.quantite)} {e.unite || ''})
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        {e.numero_recu} · {formatDateTime(e.date_achat)}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                      {formatSensitiveFCFA(e.prix_total, isMasked)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#065F46]">
                Total des achats ({suppPurchases.length} entrée(s)) :
              </span>
              <span className="text-base font-mono font-bold text-[#047857] tabular-nums">
                {formatSensitiveFCFA(
                  suppPurchases.reduce((a, e) => a + Number(e.prix_total || 0), 0),
                  isMasked
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deletingSupp}
        title="Supprimer le fournisseur"
        message={`Voulez-vous vraiment supprimer le fournisseur "${deletingSupp?.nom_complet}" ?`}
        confirmLabel="Supprimer"
        loading={submitting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingSupp(null)}
      />
    </div>
  );
};
