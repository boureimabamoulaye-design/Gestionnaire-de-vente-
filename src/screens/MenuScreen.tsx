import React from 'react';
import {
  ArrowDownLeft,
  Tags,
  Users,
  Truck,
  FileText,
  BarChart3,
  Settings,
  ChevronRight,
  History,
} from 'lucide-react';
import { ScreenName } from '../types';

interface MenuScreenProps {
  onNavigate: (screen: ScreenName) => void;
  counts: {
    historique?: number;
    entrees: number;
    categories: number;
    clients: number;
    fournisseurs: number;
    recus: number;
  };
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ onNavigate, counts }) => {
  const menuItems: Array<{
    id: ScreenName;
    title: string;
    subtitle: string;
    meta?: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'Historique',
      title: 'Historique',
      subtitle: 'Liste chronologique des ventes et achats avec filtre par date',
      meta: `${counts.historique ?? counts.entrees}`,
      icon: <History className="w-5 h-5 text-[#047857]" />,
    },
    {
      id: 'Entrees',
      title: 'Entrées / Achats',
      subtitle: 'Enregistrer les produits achetés et approvisionner le stock',
      meta: `${counts.entrees}`,
      icon: <ArrowDownLeft className="w-5 h-5 text-[#047857]" />,
    },
    {
      id: 'Categories',
      title: 'Catégories',
      subtitle: 'Gérer les familles de produits',
      meta: `${counts.categories}`,
      icon: <Tags className="w-5 h-5 text-[#047857]" />,
    },
    {
      id: 'Clients',
      title: 'Clients',
      subtitle: 'Répertoire des clients et historique des ventes',
      meta: `${counts.clients}`,
      icon: <Users className="w-5 h-5 text-[#047857]" />,
    },
    {
      id: 'Fournisseurs',
      title: 'Fournisseurs',
      subtitle: 'Répertoire des fournisseurs et historique des achats',
      meta: `${counts.fournisseurs}`,
      icon: <Truck className="w-5 h-5 text-[#047857]" />,
    },
    {
      id: 'Recus',
      title: 'Reçus',
      subtitle: 'Consulter, imprimer et exporter les reçus en PDF',
      meta: `${counts.recus}`,
      icon: <FileText className="w-5 h-5 text-[#047857]" />,
    },
    {
      id: 'Rapports',
      title: 'Rapports',
      subtitle: 'Bilans périodiques des ventes, achats et stocks',
      icon: <BarChart3 className="w-5 h-5 text-[#047857]" />,
    },
    {
      id: 'Parametres',
      title: 'Paramètres',
      subtitle: 'Confidentialité, affichage et synchronisation',
      icon: <Settings className="w-5 h-5 text-[#047857]" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl divide-y md:divide-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-px md:bg-slate-100 divide-slate-100 overflow-hidden">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className="w-full bg-white px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#ECFDF5]/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {item.meta && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-mono font-semibold text-slate-600 tabular-nums">
                  {item.meta}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
