import React, { useCallback, useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { PeriodeFilter, RapportData, VenteMensuelle } from '../types';
import { apiClient } from '../api/client';
import { formatDateTime, formatFCFA, formatNumber, getTodayInputDate } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';
import { pdfService } from '../services/pdfService';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Loading } from '../components/Loading';
import { SalesEvolutionChart } from '../components/SalesEvolutionChart';

type ReportTab = 'ventes' | 'achats' | 'stock' | 'produits' | 'clients' | 'fournisseurs';

export const ReportsScreen: React.FC = () => {
  const { isMasked } = usePrivacyMask();
  const [periode, setPeriode] = useState<PeriodeFilter>('mois');
  const [dateDebut, setDateDebut] = useState<string>(getTodayInputDate());
  const [dateFin, setDateFin] = useState<string>(getTodayInputDate());
  const [activeTab, setActiveTab] = useState<ReportTab>('ventes');
  const [report, setReport] = useState<RapportData | null>(null);
  const [ventesMensuelles, setVentesMensuelles] = useState<VenteMensuelle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const [data, mensuelles] = await Promise.all([
        apiClient.getRapports(
          periode,
          periode === 'personnalise' ? dateDebut : undefined,
          periode === 'personnalise' ? dateFin : undefined
        ),
        apiClient.getVentesMensuelles().catch(() => []),
      ]);
      setReport(data);
      if (mensuelles && mensuelles.length > 0) {
        setVentesMensuelles(mensuelles);
      }
    } finally {
      setLoading(false);
    }
  }, [periode, dateDebut, dateFin]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Rapports</h1>
          <p className="text-xs text-slate-500 truncate">
            Bilans périodiques des ventes, achats et stocks avec export PDF pour impression et archivage
          </p>
        </div>
        {report && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pdfService.exportReportToPDF(report, 'ventes')}
              icon={<FileDown className="w-4 h-4 text-[#047857]" />}
            >
              PDF Ventes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pdfService.exportReportToPDF(report, 'stock')}
              icon={<FileDown className="w-4 h-4 text-[#047857]" />}
            >
              PDF Stocks
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                activeTab === 'ventes' || activeTab === 'stock'
                  ? pdfService.exportCombinedSalesAndStockToPDF(report)
                  : pdfService.exportReportToPDF(report, activeTab)
              }
              icon={<FileDown className="w-4 h-4" />}
            >
              {activeTab === 'ventes' || activeTab === 'stock'
                ? 'Bilan Ventes & Stocks (PDF)'
                : `Exporter ${activeTab} (PDF)`}
            </Button>
          </div>
        )}
      </div>

      {/* Period Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: 'aujourd_hui', label: "Aujourd'hui" },
            { id: 'semaine', label: 'Cette semaine' },
            { id: 'mois', label: 'Ce mois' },
            { id: 'annee', label: 'Cette année' },
            { id: 'personnalise', label: 'Période personnalisée' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriode(p.id as PeriodeFilter)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                periode === p.id
                  ? 'bg-[#047857] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periode === 'personnalise' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 items-end">
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
            <Button variant="secondary" fullWidth onClick={loadReport}>
              Actualiser
            </Button>
          </div>
        )}
      </div>

      {loading || !report ? (
        <Loading message="Calcul des rapports en cours..." />
      ) : (
        <>
          {/* 6 Mandatory Summary Indicators in a Responsive Grid (2x3 mobile, 3x2 tablet, 6x1 wide PC) */}
          <div className="bg-white border border-slate-200/90 rounded-xl grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-y divide-slate-100 overflow-hidden">
            <div className="p-2.5 sm:p-3 bg-[#ECFDF5]/60">
              <span className="block text-[11px] text-[#065F46] font-medium truncate">Total des ventes</span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums">
                {formatSensitiveFCFA(report.resume.total_ventes, isMasked)}
              </strong>
            </div>
            <div className="p-2.5 sm:p-3">
              <span className="block text-[11px] text-slate-500 truncate">Total des achats</span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums">
                {formatSensitiveFCFA(report.resume.total_achats, isMasked)}
              </strong>
            </div>
            <div className="p-2.5 sm:p-3">
              <span className="block text-[11px] text-slate-500 truncate">Nombre de ventes</span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums">
                {formatNumber(report.resume.nombre_ventes)} vente(s)
              </strong>
            </div>
            <div className="p-2.5 sm:p-3">
              <span className="block text-[11px] text-slate-500 truncate">Nombre d'achats</span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums">
                {formatNumber(report.resume.nombre_achats)} entrée(s)
              </strong>
            </div>
            <div className="p-2.5 sm:p-3">
              <span className="block text-[11px] text-slate-500 truncate">Produits vendus</span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums">
                {formatNumber(report.resume.produits_vendus)} unités
              </strong>
            </div>
            <div className="p-2.5 sm:p-3">
              <span className="block text-[11px] text-slate-500 truncate">Produits achetés</span>
              <strong className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums">
                {formatNumber(report.resume.produits_achetes)} unités
              </strong>
            </div>
          </div>

          {/* 6 Report Type Selector Tabs */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'ventes', label: 'Rapport des ventes' },
              { id: 'achats', label: 'Rapport des achats' },
              { id: 'stock', label: 'Rapport du stock' },
              { id: 'produits', label: 'Rapport des produits' },
              { id: 'clients', label: 'Rapport des clients' },
              { id: 'fournisseurs', label: 'Rapport des fournisseurs' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as ReportTab)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-[#047857] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Unified Compact List of Report Items */}
          {activeTab === 'ventes' && (
            <div className="space-y-4">
              <SalesEvolutionChart data={ventesMensuelles} loading={loading} />
              <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50/80 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>DÉTAIL DES VENTES DE LA PÉRIODE ({report.ventes.length})</span>
                  <span>MONTANT TOTAL</span>
                </div>
                {report.ventes.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">Aucune vente sur cette période.</p>
                ) : (
                  report.ventes.map((v) => (
                    <div key={v.id} className="px-3.5 py-2.5 sm:px-4 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{v.produit_nom}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {v.client_nom} · {v.numero_recu} · {formatDateTime(v.date_vente)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums">
                          {formatSensitiveFCFA(v.prix_total, isMasked)}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                          Qté : {formatNumber(v.quantite)} {v.unite}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab !== 'ventes' && (
            <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 overflow-hidden">

            {activeTab === 'achats' &&
              (report.achats.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">Aucun achat sur cette période.</p>
              ) : (
                report.achats.map((a) => (
                  <div key={a.id} className="px-3.5 py-2.5 sm:px-4 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{a.produit_nom}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {a.fournisseur_nom} · {a.numero_recu} · {formatDateTime(a.date_achat)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums">
                        {formatSensitiveFCFA(a.prix_total, isMasked)}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                        Qté : +{formatNumber(a.quantite)} {a.unite}
                      </p>
                    </div>
                  </div>
                ))
              ))}

            {activeTab === 'stock' &&
              report.stock.map((s) => (
                <div key={s.produit_id} className="px-3.5 py-2.5 sm:px-4 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{s.produit_nom}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {s.categorie_nom} · Entrées : +{formatNumber(s.total_entrees)} · Sorties : -
                      {formatNumber(s.total_sorties)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums">
                      {formatNumber(s.quantite_disponible)} {s.unite}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {s.statut}
                    </p>
                  </div>
                </div>
              ))}

            {activeTab === 'produits' &&
              report.produits.map((p) => (
                <div key={p.id} className="px-3.5 py-2.5 sm:px-4 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{p.nom}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {p.categorie_nom} · Unité : {p.unite}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums">
                      {formatSensitiveFCFA(p.ca_periode, isMasked)}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                      Vendu : {formatNumber(p.qte_vendue_periode)} {p.unite}
                    </p>
                  </div>
                </div>
              ))}

            {activeTab === 'clients' &&
              report.clients.map((c) => (
                <div key={c.id} className="px-3.5 py-2.5 sm:px-4 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{c.nom_complet}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {c.telephone || '-'} · {c.adresse || '-'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-mono font-bold text-[#047857] tabular-nums">
                      {formatSensitiveFCFA(c.chiffre_affaires, isMasked)}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {formatNumber(c.nombre_ventes)} achat(s)
                    </p>
                  </div>
                </div>
              ))}

            {activeTab === 'fournisseurs' &&
              report.fournisseurs.map((f) => (
                <div key={f.id} className="px-3.5 py-2.5 sm:px-4 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{f.nom_complet}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {f.telephone || '-'} · {f.adresse || '-'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-mono font-bold text-slate-900 tabular-nums">
                      {formatSensitiveFCFA(f.montant_total, isMasked)}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {formatNumber(f.nombre_achats)} livraison(s)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
