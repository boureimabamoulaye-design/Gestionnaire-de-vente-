import React from 'react';
import {
  Plus,
  ShoppingBag,
  ArrowDownLeft,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  TrendingUp,
  Package,
  Layers,
  FileText,
  ChevronRight,
  User,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DashboardData, Recu, ScreenName } from '../types';
import { formatDateTime, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';
import { Loading } from '../components/Loading';
import { SalesEvolutionChart } from '../components/SalesEvolutionChart';

interface DashboardScreenProps {
  data: DashboardData | null;
  loading: boolean;
  recus: Recu[];
  onNavigate: (screen: ScreenName) => void;
  onQuickAction?: (screen: 'Ventes' | 'Entrees' | 'Produits') => void;
  onOpenReceipt: (recu: Recu) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  data,
  loading,
  recus,
  onNavigate,
  onQuickAction,
  onOpenReceipt,
}) => {
  const { isMasked, toggleMask } = usePrivacyMask();

  if (loading && !data) {
    return <Loading message="Chargement du tableau de bord..." />;
  }

  const stats = data?.stats || {
    nombre_produits: 0,
    quantite_totale_stock: 0,
    ventes_jour_nombre: 0,
    ventes_jour_montant: 0,
    achats_jour_nombre: 0,
    achats_jour_montant: 0,
    chiffre_affaires: 0,
    total_achats: 0,
    produits_stock_faible: 0,
    produits_en_rupture: 0,
  };

  const handleOpenReceiptByNumber = (numeroRecu: string) => {
    const found = recus.find((r) => r.numero_recu === numeroRecu);
    if (found) {
      onOpenReceipt(found);
      return;
    }
    const sale = (data?.dernieres_ventes || []).find((v) => v.numero_recu === numeroRecu);
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
      return;
    }
    const entree = (data?.dernieres_entrees || []).find((e) => e.numero_recu === numeroRecu);
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

  const kpiListRows = [
    {
      id: 'ventes_jour',
      title: 'Ventes du jour',
      subtitle: `${formatNumber(stats.ventes_jour_nombre)} vente(s) aujourd'hui`,
      value: formatSensitiveFCFA(stats.ventes_jour_montant, isMasked),
      valueColor: 'text-[#047857]',
      iconBg: 'bg-[#ECFDF5] text-[#047857]',
      icon: <ShoppingBag className="w-5 h-5" />,
      target: 'Ventes' as ScreenName,
    },
    {
      id: 'achats_jour',
      title: 'Achats du jour',
      subtitle: `${formatNumber(stats.achats_jour_nombre)} entrée(s) aujourd'hui`,
      value: formatSensitiveFCFA(stats.achats_jour_montant, isMasked),
      valueColor: 'text-slate-900',
      iconBg: 'bg-slate-100 text-[#047857]',
      icon: <ArrowDownLeft className="w-5 h-5" />,
      target: 'Entrees' as ScreenName,
    },
    {
      id: 'nombre_produits',
      title: 'Nombre de produits',
      subtitle: 'Références dans le catalogue',
      value: `${formatNumber(stats.nombre_produits)} produit(s)`,
      valueColor: 'text-slate-900',
      iconBg: 'bg-[#ECFDF5] text-[#047857]',
      icon: <Package className="w-5 h-5" />,
      target: 'Produits' as ScreenName,
    },
    {
      id: 'quantite_stock',
      title: 'Quantité totale en stock',
      subtitle: 'Unités disponibles',
      value: `${formatNumber(stats.quantite_totale_stock)} unités`,
      valueColor: 'text-[#047857]',
      iconBg: 'bg-[#ECFDF5] text-[#047857]',
      icon: <Layers className="w-5 h-5" />,
      target: 'Stock' as ScreenName,
    },
    {
      id: 'stock_faible',
      title: 'Produits en stock faible',
      subtitle: "Articles sous le seuil d'alerte",
      value: `${formatNumber(stats.produits_stock_faible)} alerte(s)`,
      valueColor: stats.produits_stock_faible > 0 ? 'text-amber-600' : 'text-slate-600',
      iconBg: 'bg-amber-50 text-amber-600',
      icon: <AlertTriangle className="w-5 h-5" />,
      target: 'Stock' as ScreenName,
    },
    {
      id: 'rupture',
      title: 'Produits en rupture',
      subtitle: 'Articles avec stock à 0',
      value: `${formatNumber(stats.produits_en_rupture)} rupture(s)`,
      valueColor: stats.produits_en_rupture > 0 ? 'text-red-600' : 'text-slate-600',
      iconBg: 'bg-red-50 text-red-600',
      icon: <XCircle className="w-5 h-5" />,
      target: 'Stock' as ScreenName,
    },
  ];

  return (
    <div className="space-y-3.5 lg:space-y-5">
      {/* Perfectly Aligned Quick Action Bar on Mobile & PC */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3.5 md:flex md:items-center md:justify-between md:gap-4">
        <div className="hidden md:block min-w-0">
          <h2 className="text-sm lg:text-base font-bold text-slate-900 truncate">
            Opérations rapides
          </h2>
          <p className="text-xs text-slate-500 truncate">
            Enregistrer une vente, une entrée ou un produit
          </p>
        </div>

        <div className="grid grid-cols-3 md:flex md:items-center gap-2">
          <button
            type="button"
            onClick={() => (onQuickAction ? onQuickAction('Ventes') : onNavigate('Ventes'))}
            className="h-10 px-2.5 md:px-4 rounded-xl bg-[#047857] text-white hover:bg-[#065F46] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate sm:hidden">Vente</span>
            <span className="hidden sm:inline truncate">+ Nouvelle vente</span>
          </button>
          <button
            type="button"
            onClick={() => (onQuickAction ? onQuickAction('Entrees') : onNavigate('Entrees'))}
            className="h-10 px-2.5 md:px-4 rounded-xl bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] hover:bg-[#D1FAE5] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate sm:hidden">Entrée</span>
            <span className="hidden sm:inline truncate">+ Nouvelle entrée</span>
          </button>
          <button
            type="button"
            onClick={() => (onQuickAction ? onQuickAction('Produits') : onNavigate('Produits'))}
            className="h-10 px-2.5 md:px-4 rounded-xl bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#047857] shrink-0" />
            <span className="truncate sm:hidden">Produit</span>
            <span className="hidden sm:inline truncate">+ Produit</span>
          </button>
        </div>
      </section>

      {/* Chiffre d'affaires (Masked by default for privacy) + 6 KPI Indicators */}
      <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
        <div className="bg-[#047857] text-white px-3.5 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3">
          <div
            onClick={() => onNavigate('Rapports')}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-[#A7F3D0]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-white truncate">
                Chiffre d'affaires global
              </p>
              <p className="text-[11px] text-[#A7F3D0] truncate">
                Cumul des ventes enregistrées
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm sm:text-lg font-mono font-bold tabular-nums">
              {formatSensitiveFCFA(stats.chiffre_affaires, isMasked)}
            </span>
            <button
              type="button"
              onClick={toggleMask}
              aria-label={isMasked ? 'Afficher les montants' : 'Masquer les montants'}
              title={isMasked ? 'Afficher les montants' : 'Masquer les montants'}
              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition-colors shrink-0"
            >
              {isMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 1-Column List on Mobile, 2-Column Grid on Tablet, 3-Column Grid on PC */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:gap-px bg-slate-100">
          {kpiListRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onNavigate(row.target)}
              className="w-full bg-white px-3.5 py-3 sm:px-4 sm:py-3.5 flex items-center justify-between gap-2.5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${row.iconBg}`}
                >
                  {row.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                    {row.title}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{row.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-xs sm:text-sm font-mono font-bold tabular-nums ${row.valueColor}`}>
                  {row.value}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Graphique en courbes : Évolution du volume des ventes sur les 6 derniers mois (MySQL) */}
      <SalesEvolutionChart
        data={data?.evolution_ventes_mensuelles || []}
        loading={loading}
      />

      {/* 4 Detailed List Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Section 1: Dernières ventes */}
        <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
          <div className="px-3.5 py-2.5 sm:px-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Dernières ventes</h2>
            <button
              type="button"
              onClick={() => onNavigate('Ventes')}
              className="text-xs font-semibold text-[#047857] hover:underline cursor-pointer"
            >
              Voir tout
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {(data?.dernieres_ventes || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Aucune vente enregistrée.</p>
            ) : (
              (data?.dernieres_ventes || []).map((v) => (
                <div key={v.id} className="px-3.5 py-2.5 sm:px-4 hover:bg-slate-50/60">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {v.produit_nom}
                      </p>
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                        · Qté: {formatNumber(v.quantite)} {v.unite || ''}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums shrink-0">
                      {formatSensitiveFCFA(v.prix_total, isMasked)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
                      <User className="w-3 h-3 text-[#047857] shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">{v.client_nom}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{formatDateTime(v.date_vente)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenReceiptByNumber(v.numero_recu)}
                      className="h-6 px-2 rounded-md bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Reçu</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Section 2: Dernières entrées */}
        <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
          <div className="px-3.5 py-2.5 sm:px-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Dernières entrées</h2>
            <button
              type="button"
              onClick={() => onNavigate('Entrees')}
              className="text-xs font-semibold text-[#047857] hover:underline cursor-pointer"
            >
              Voir tout
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {(data?.dernieres_entrees || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Aucune entrée enregistrée.</p>
            ) : (
              (data?.dernieres_entrees || []).map((e) => (
                <div key={e.id} className="px-3.5 py-2.5 sm:px-4 hover:bg-slate-50/60">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {e.produit_nom}
                      </p>
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                        · Qté: +{formatNumber(e.quantite)} {e.unite || ''}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums shrink-0">
                      {formatSensitiveFCFA(e.prix_total, isMasked)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-slate-700 truncate">
                        {e.fournisseur_nom}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{formatDateTime(e.date_achat)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenReceiptByNumber(e.numero_recu)}
                      className="h-6 px-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <FileText className="w-3 h-3 text-[#047857]" />
                      <span>Reçu</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Section 3: Produits les plus vendus */}
        <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
          <div className="px-3.5 py-2.5 sm:px-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Produits les plus vendus</h2>
            <button
              type="button"
              onClick={() => onNavigate('Rapports')}
              className="text-xs font-semibold text-[#047857] hover:underline cursor-pointer"
            >
              Rapports
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {(data?.produits_plus_vendus || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Aucune donnée de vente disponible.
              </p>
            ) : (
              (data?.produits_plus_vendus || []).map((p, idx) => (
                <div
                  key={p.id}
                  className="px-3.5 py-2.5 sm:px-4 flex items-center justify-between gap-2 hover:bg-slate-50/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-md bg-[#ECFDF5] text-[#047857] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        {p.nom}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {p.categorie_nom} · Dispo : {formatNumber(p.stock_disponible)} {p.unite}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-bold text-[#047857] tabular-nums">
                      {formatNumber(p.quantite_vendue)} {p.unite}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {formatSensitiveFCFA(p.chiffre_affaires, isMasked)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Section 4: Produits en stock faible & rupture */}
        <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
          <div className="px-3.5 py-2.5 sm:px-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Produits en stock faible</h2>
            <button
              type="button"
              onClick={() => onNavigate('Entrees')}
              className="text-xs font-semibold text-[#047857] hover:underline cursor-pointer"
            >
              Approvisionner
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {(data?.produits_stock_faible || []).length === 0 ? (
              <div className="py-6 text-center flex flex-col items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                <p className="text-xs text-slate-500">Tous les produits ont un stock suffisant.</p>
              </div>
            ) : (
              (data?.produits_stock_faible || []).map((st) => (
                <div
                  key={st.produit_id}
                  className="px-3.5 py-2.5 sm:px-4 flex items-center justify-between gap-2 hover:bg-slate-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      {st.produit_nom}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {st.categorie_nom} · Seuil : {formatNumber(st.seuil_alerte)} {st.unite}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {st.statut === 'RUPTURE' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                        <XCircle className="w-3 h-3" />
                        <span>RUPTURE (0)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        <span>
                          {formatNumber(st.quantite_disponible)} {st.unite}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
