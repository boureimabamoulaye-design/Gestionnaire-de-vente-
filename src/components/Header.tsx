import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, RefreshCw, WifiOff } from 'lucide-react';
import { ScreenName } from '../types';
import { usePrivacyMask } from '../utils/privacy';

interface HeaderProps {
  activeScreen: ScreenName;
  onNavigate: (screen: ScreenName) => void;
  isOnline: boolean;
  onRefresh?: () => Promise<void> | void;
}

const navLinks: Array<{ id: ScreenName; label: string }> = [
  { id: 'Accueil', label: 'Accueil' },
  { id: 'Produits', label: 'Produits' },
  { id: 'Entrees', label: 'Entrées' },
  { id: 'Ventes', label: 'Ventes' },
  { id: 'Stock', label: 'Stock' },
  { id: 'Historique', label: 'Historique' },
  { id: 'Clients', label: 'Clients' },
  { id: 'Fournisseurs', label: 'Fournisseurs' },
  { id: 'Rapports', label: 'Rapports' },
];

const screenTitles: Record<ScreenName, string> = {
  Accueil: 'Tableau de bord',
  Produits: 'Produits',
  Ventes: 'Ventes',
  Stock: 'État du Stock',
  Menu: 'Menu',
  Historique: 'Historique',
  Entrees: 'Entrées / Achats',
  Categories: 'Catégories',
  Clients: 'Clients',
  Fournisseurs: 'Fournisseurs',
  Recus: 'Reçus',
  Rapports: 'Rapports',
  Parametres: 'Paramètres',
};

export const Header: React.FC<HeaderProps> = ({
  activeScreen,
  onNavigate,
  isOnline,
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const { isMasked, toggleMask } = usePrivacyMask();

  const isSubScreen = [
    'Historique',
    'Entrees',
    'Categories',
    'Clients',
    'Fournisseurs',
    'Recus',
    'Rapports',
    'Parametres',
  ].includes(activeScreen);

  const handleRefreshClick = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3.5 sm:px-6 flex items-center justify-between gap-3 shadow-2xs no-print">
      {/* Left: Back button on mobile sub-screens + Page Title only */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isSubScreen && (
          <button
            type="button"
            onClick={() => onNavigate('Menu')}
            aria-label="Retour au menu"
            className="md:hidden w-9 h-9 -ml-1 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-[#047857] cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
          {screenTitles[activeScreen] || 'Tableau de bord'}
        </h1>
      </div>

      {/* Center: Clean Navigation Links on PC */}
      <nav className="hidden xl:flex items-center gap-5 text-xs font-semibold text-slate-600 shrink-0">
        {navLinks.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`py-1 transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                isActive
                  ? 'text-[#047857] border-[#047857]'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right: Privacy Mask Toggle & Refresh Action */}
      <div className="flex items-center gap-2 shrink-0">
        {!isOnline && (
          <span className="h-9 px-2.5 rounded-xl text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1.5 shrink-0">
            <WifiOff className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Hors-ligne</span>
          </span>
        )}

        <button
          type="button"
          onClick={toggleMask}
          title={isMasked ? 'Afficher les montants sensibles' : 'Masquer les montants sensibles'}
          aria-label={isMasked ? 'Afficher les montants sensibles' : 'Masquer les montants sensibles'}
          className={`h-9 px-2.5 sm:px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
            isMasked
              ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
          }`}
        >
          {isMasked ? (
            <>
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Masqué</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Visible</span>
            </>
          )}
        </button>

        {onRefresh && (
          <button
            type="button"
            onClick={handleRefreshClick}
            title="Actualiser"
            aria-label="Actualiser"
            className="h-9 w-9 sm:w-auto sm:px-3 rounded-xl text-xs font-semibold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]/80 hover:bg-[#D1FAE5] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#047857] shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        )}
      </div>
    </header>
  );
};
