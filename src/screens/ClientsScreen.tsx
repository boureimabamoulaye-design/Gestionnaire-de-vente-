import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, History, X, Users } from 'lucide-react';
import { Client, Sortie } from '../types';
import { apiClient } from '../api/client';
import { formatDateShort, formatDateTime, formatFCFA, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ClientsScreenProps {
  clients: Client[];
  onCreate: (payload: Partial<Client>) => Promise<void>;
  onUpdate: (id: number, payload: Partial<Client>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export const ClientsScreen: React.FC<ClientsScreenProps> = ({
  clients,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const { isMasked } = usePrivacyMask();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [clientSales, setClientSales] = useState<Sortie[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states
  const [nomComplet, setNomComplet] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.nom_complet.toLowerCase().includes(q) ||
        (c.telephone || '').toLowerCase().includes(q) ||
        (c.adresse || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  const openAdd = () => {
    setEditingClient(null);
    setNomComplet('');
    setTelephone('');
    setAdresse('');
    setEmail('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setNomComplet(c.nom_complet);
    setTelephone(c.telephone || '');
    setAdresse(c.adresse || '');
    setEmail(c.email || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const openHistory = async (c: Client) => {
    setHistoryClient(c);
    setLoadingHistory(true);
    try {
      const res = await apiClient.getClientHistory(c.id);
      setClientSales(res.ventes || []);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!nomComplet.trim()) {
      setFormError('Le nom complet du client est obligatoire.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingClient) {
        await onUpdate(editingClient.id, {
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
    if (!deletingClient) return;
    setSubmitting(true);
    try {
      await onDelete(deletingClient.id);
      setDeletingClient(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Clients</h1>
          <p className="text-xs text-slate-500 truncate">
            {formatNumber(filtered.length)} client(s) enregistré(s)
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
          placeholder="Rechercher un client par nom, téléphone, adresse..."
        />
      </div>

      {/* Unified Compact Clients List */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Aucun client trouvé"
          description="Ajoutez vos clients pour suivre leurs achats et éditer leurs reçus."
          actionLabel="Ajouter un client"
          onAction={openAdd}
        />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 px-4 py-2.5 bg-slate-50/90 text-[11px] font-semibold text-slate-500">
            <span className="col-span-3">NOM COMPLET ({filtered.length})</span>
            <span className="col-span-2">TÉLÉPHONE</span>
            <span className="col-span-2">ADRESSE</span>
            <span className="col-span-1 text-right">VENTES</span>
            <span className="col-span-2 text-right">MONTANT TOTAL</span>
            <span className="col-span-2 text-right">ACTIONS</span>
          </div>
          {filtered.map((client) => (
            <div
              key={client.id}
              className="px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 transition-colors"
            >
              {/* Version Mobile & Tablette (< lg) */}
              <div className="lg:hidden">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {client.nom_complet}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      · {client.telephone || 'Sans tél.'}
                    </span>
                  </div>

                  <span className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums shrink-0">
                    {formatSensitiveFCFA(client.montant_total || 0, isMasked)}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
                    <span className="font-mono font-semibold text-slate-700 shrink-0">
                      {formatNumber(client.nombre_achats || 0)} vente(s)
                    </span>
                    {client.adresse && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{client.adresse}</span>
                      </>
                    )}
                    <span className="hidden sm:inline" aria-hidden="true">·</span>
                    <span className="hidden sm:inline text-slate-400 shrink-0">
                      {formatDateShort(client.date_ajout)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openHistory(client)}
                      className="h-7 px-2 rounded-lg bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <History className="w-3 h-3" />
                      <span>Historique</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(client)}
                      className="h-7 w-7 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingClient(client)}
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
                  <p className="text-sm font-bold text-slate-900 truncate">{client.nom_complet}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    Ajouté le {formatDateShort(client.date_ajout)}
                  </p>
                </div>
                <div className="col-span-2 font-mono text-xs text-slate-700 truncate">
                  {client.telephone || 'Sans tél.'}
                </div>
                <div className="col-span-2 text-xs text-slate-600 truncate">
                  {client.adresse || '—'}
                </div>
                <div className="col-span-1 text-right font-mono text-xs font-semibold text-slate-800 tabular-nums">
                  {formatNumber(client.nombre_achats || 0)}
                </div>
                <div className="col-span-2 text-right font-mono text-sm font-bold text-[#047857] tabular-nums">
                  {formatSensitiveFCFA(client.montant_total || 0, isMasked)}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => openHistory(client)}
                    className="h-8 px-2.5 rounded-lg bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Historique</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(client)}
                    className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingClient(client)}
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

      {/* Add / Edit Client Web Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingClient ? 'Modifier le client' : 'Ajouter un client'}
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
                placeholder="Ex: Ferme Avicole Diarra & Frères"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                required
              />
              <Input
                label="Téléphone *"
                placeholder="Ex: +223 75 88 41 20"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
              <Input
                label="Adresse"
                placeholder="Ex: Baguineda, Bamako"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
              />
              <Input
                label="Email"
                type="email"
                placeholder="Ex: client@exemple.com"
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

      {/* Client Sales History Web Modal */}
      {historyClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  Historique des ventes — {historyClient.nom_complet}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tél : {historyClient.telephone || '-'} · Adresse : {historyClient.adresse || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryClient(null)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200/80 rounded-xl">
              {loadingHistory ? (
                <p className="py-8 text-center text-xs text-slate-500">Chargement de l'historique...</p>
              ) : clientSales.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Aucune vente enregistrée pour ce client.
                </p>
              ) : (
                clientSales.map((v) => (
                  <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {v.produit_nom} ({formatNumber(v.quantite)} {v.unite || ''})
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        {v.numero_recu} · {formatDateTime(v.date_vente)}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-[#047857] tabular-nums shrink-0">
                      {formatSensitiveFCFA(v.prix_total, isMasked)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#065F46]">
                Total cumulé ({clientSales.length} vente(s)) :
              </span>
              <span className="text-base font-mono font-bold text-[#047857] tabular-nums">
                {formatSensitiveFCFA(
                  clientSales.reduce((a, s) => a + Number(s.prix_total || 0), 0),
                  isMasked
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deletingClient}
        title="Supprimer le client"
        message={`Voulez-vous vraiment supprimer le client "${deletingClient?.nom_complet}" ?`}
        confirmLabel="Supprimer"
        loading={submitting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingClient(null)}
      />
    </div>
  );
};
