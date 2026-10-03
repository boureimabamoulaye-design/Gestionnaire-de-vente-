import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { TrendingUp, Layers, DollarSign, Calendar } from 'lucide-react';
import { VenteMensuelle } from '../types';
import { formatFCFA, formatNumber } from '../utils/formatters';
import { formatSensitiveFCFA, usePrivacyMask } from '../utils/privacy';

interface SalesEvolutionChartProps {
  data: VenteMensuelle[];
  loading?: boolean;
}

type ChartMetric = 'volume' | 'ca' | 'both';

export const SalesEvolutionChart: React.FC<SalesEvolutionChartProps> = ({ data, loading }) => {
  const [metric, setMetric] = useState<ChartMetric>('volume');
  const { isMasked } = usePrivacyMask();

  const chartData = data && data.length > 0 ? data : [];

  const totalVolume6Mois = chartData.reduce((acc, m) => acc + Number(m.volume_quantite || 0), 0);
  const totalCA6Mois = chartData.reduce((acc, m) => acc + Number(m.chiffre_affaires || 0), 0);
  const totalTransactions6Mois = chartData.reduce((acc, m) => acc + Number(m.nombre_ventes || 0), 0);
  const moyenneMensuelleVolume = Math.round(totalVolume6Mois / (chartData.length || 1));

  // Find peak month
  const peakMonth = [...chartData].sort((a, b) => b.volume_quantite - a.volume_quantite)[0];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: VenteMensuelle = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl p-3 shadow-lg text-xs space-y-1.5 min-w-[190px]">
          <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100 font-semibold text-slate-800">
            <Calendar className="w-3.5 h-3.5 text-[#047857]" />
            <span>{item.mois_label}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#047857]" />
              <span>Volume vendu :</span>
            </span>
            <strong className="font-mono font-bold text-[#047857] tabular-nums">
              {formatNumber(item.volume_quantite)} unités
            </strong>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Chiffre d'affaires :</span>
            </span>
            <strong className="font-mono font-bold text-slate-900 tabular-nums">
              {formatSensitiveFCFA(item.chiffre_affaires, isMasked)}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400 pt-0.5 border-t border-slate-50">
            <span>Nombre de ventes :</span>
            <span className="font-mono tabular-nums">{formatNumber(item.nombre_ventes)} vente(s)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#047857] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Évolution du volume des ventes
            </h2>
          </div>
        </div>

        {/* View toggle */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setMetric('volume')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              metric === 'volume'
                ? 'bg-white text-[#047857] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Volume (Unités)
          </button>
          <button
            type="button"
            onClick={() => setMetric('ca')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              metric === 'ca'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chiffre d'affaires
          </button>
          <button
            type="button"
            onClick={() => setMetric('both')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              metric === 'both'
                ? 'bg-white text-[#047857] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Combiné
          </button>
        </div>
      </div>

      {/* KPI mini-strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100 bg-slate-50/60 text-xs">
        <div className="p-3 sm:px-4">
          <span className="text-[11px] text-slate-500 block truncate">Volume total vendu</span>
          <strong className="font-mono font-bold text-sm text-[#047857] tabular-nums mt-0.5 block">
            {formatNumber(totalVolume6Mois)} unités
          </strong>
        </div>
        <div className="p-3 sm:px-4">
          <span className="text-[11px] text-slate-500 block truncate">Chiffre d'affaires cumulé</span>
          <strong className="font-mono font-bold text-sm text-slate-900 tabular-nums mt-0.5 block">
            {formatSensitiveFCFA(totalCA6Mois, isMasked)}
          </strong>
        </div>
        <div className="p-3 sm:px-4">
          <span className="text-[11px] text-slate-500 block truncate">Moyenne mensuelle</span>
          <strong className="font-mono font-semibold text-sm text-slate-700 tabular-nums mt-0.5 block">
            ~{formatNumber(moyenneMensuelleVolume)} unités / mois
          </strong>
        </div>
        <div className="p-3 sm:px-4">
          <span className="text-[11px] text-slate-500 block truncate">Mois le plus actif</span>
          <strong className="font-semibold text-xs text-slate-800 truncate mt-1 block">
            {peakMonth && peakMonth.volume_quantite > 0
              ? `${peakMonth.mois_court} (${formatNumber(peakMonth.volume_quantite)} u.)`
              : 'En attente de ventes'}
          </strong>
        </div>
      </div>

      {/* Graphique en courbes (Recharts) */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">
            Chargement de la courbe d'évolution...
          </div>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#047857" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="mois_court"
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                />
                {(metric === 'volume' || metric === 'both') && (
                  <YAxis
                    yAxisId="volume"
                    orientation="left"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#047857' }}
                    tickFormatter={(val) => `${val}`}
                  />
                )}
                {(metric === 'ca' || metric === 'both') && (
                  <YAxis
                    yAxisId="ca"
                    orientation={metric === 'both' ? 'right' : 'left'}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#D97706' }}
                    tickFormatter={(val) => {
                      if (isMasked) return '•••';
                      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                      if (val >= 1000) return `${Math.round(val / 1000)}k`;
                      return `${val}`;
                    }}
                  />
                )}
                <Tooltip content={<CustomTooltip />} />

                {/* Area under curves */}
                {(metric === 'volume' || metric === 'both') && (
                  <Area
                    yAxisId="volume"
                    type="monotone"
                    dataKey="volume_quantite"
                    fill="url(#volumeGradient)"
                    stroke="none"
                  />
                )}
                {metric === 'ca' && (
                  <Area
                    yAxisId="ca"
                    type="monotone"
                    dataKey="chiffre_affaires"
                    fill="url(#caGradient)"
                    stroke="none"
                  />
                )}

                {/* Main Lines */}
                {(metric === 'volume' || metric === 'both') && (
                  <Line
                    yAxisId="volume"
                    type="monotone"
                    dataKey="volume_quantite"
                    name="Volume (unités)"
                    stroke="#047857"
                    strokeWidth={2.75}
                    dot={{ fill: '#047857', stroke: '#ffffff', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#047857', stroke: '#A7F3D0', strokeWidth: 3 }}
                  />
                )}
                {(metric === 'ca' || metric === 'both') && (
                  <Line
                    yAxisId="ca"
                    type="monotone"
                    dataKey="chiffre_affaires"
                    name="Chiffre d'affaires (FCFA)"
                    stroke="#D97706"
                    strokeWidth={2.25}
                    strokeDasharray={metric === 'both' ? '4 4' : undefined}
                    dot={{ fill: '#D97706', stroke: '#ffffff', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#D97706', stroke: '#FDE68A', strokeWidth: 3 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            {(metric === 'volume' || metric === 'both') && (
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-3 h-1 bg-[#047857] rounded-full inline-block" />
                <span>Volume des ventes (unités)</span>
              </span>
            )}
            {(metric === 'ca' || metric === 'both') && (
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-3 h-1 bg-[#D97706] rounded-full inline-block" />
                <span>Chiffre d'affaires ({isMasked ? 'Masqué' : 'FCFA'})</span>
              </span>
            )}
          </div>
          <span className="text-slate-400">
            Période : 6 derniers mois
          </span>
        </div>
      </div>
    </section>
  );
};
