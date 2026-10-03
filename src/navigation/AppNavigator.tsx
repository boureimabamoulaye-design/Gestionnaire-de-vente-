import React, { useEffect, useState } from 'react';
import {
  Home,
  Package,
  ShoppingBag,
  Layers,
  Menu as MenuIcon,
  ArrowDownLeft,
  Tags,
  Users,
  Truck,
  FileText,
  BarChart3,
  Settings,
  History,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { ScreenName } from '../types';
import { useAppStore } from '../hooks/useAppStore';
import { apiClient } from '../api/client';
import { Header } from '../components/Header';
import { ReceiptModal } from '../components/ReceiptModal';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProductsScreen } from '../screens/ProductsScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { EntriesScreen } from '../screens/EntriesScreen';
import { SalesScreen } from '../screens/SalesScreen';
import { StockScreen } from '../screens/StockScreen';
import { ClientsScreen } from '../screens/ClientsScreen';
import { SuppliersScreen } from '../screens/SuppliersScreen';
import { ReceiptsScreen } from '../screens/ReceiptsScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { HistoryScreen } from '../screens/HistoryScreen';

const HASH_TO_SCREEN: Record<string, ScreenName> = {
  '#accueil': 'Accueil',
  '#produits': 'Produits',
  '#entrees': 'Entrees',
  '#ventes': 'Ventes',
  '#stock': 'Stock',
  '#historique': 'Historique',
  '#categories': 'Categories',
  '#clients': 'Clients',
  '#fournisseurs': 'Fournisseurs',
  '#recus': 'Recus',
  '#rapports': 'Rapports',
  '#parametres': 'Parametres',
  '#menu': 'Menu',
};

const SCREEN_TO_HASH: Record<ScreenName, string> = {
  Accueil: '#accueil',
  Produits: '#produits',
  Entrees: '#entrees',
  Ventes: '#ventes',
  Stock: '#stock',
  Historique: '#historique',
  Categories: '#categories',
  Clients: '#clients',
  Fournisseurs: '#fournisseurs',
  Recus: '#recus',
  Rapports: '#rapports',
  Parametres: '#parametres',
  Menu: '#menu',
};

export const AppNavigator: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ScreenName>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const mapped = HASH_TO_SCREEN[window.location.hash.toLowerCase()];
      if (mapped) return mapped;
    }
    return 'Accueil';
  });

  useEffect(() => {
    const onHashChange = () => {
      const mapped = HASH_TO_SCREEN[window.location.hash.toLowerCase()];
      if (mapped) {
        setActiveScreen(mapped);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleNavigate = (screen: ScreenName) => {
    setActiveScreen(screen);
    if (typeof window !== 'undefined') {
      const targetHash = SCREEN_TO_HASH[screen] || '#accueil';
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleQuickAction = (screen: 'Ventes' | 'Entrees' | 'Produits') => {
    handleNavigate(screen);
  };

  const {
    loading,
    isOnline,
    dashboard,
    produits,
    categories,
    entrees,
    sorties,
    stock,
    clients,
    fournisseurs,
    recus,
    mysqlStatus,
    notifications,
    notify,
    dismissNotification,
    refreshAll,
    activeReceiptModal,
    setActiveReceiptModal,
  } = useAppStore();

  const bottomTabs: Array<{ id: ScreenName; label: string; icon: React.ReactNode }> = [
    { id: 'Accueil', label: 'Accueil', icon: <Home className="w-5 h-5" strokeWidth={1.75} /> },
    { id: 'Produits', label: 'Produits', icon: <Package className="w-5 h-5" strokeWidth={1.75} /> },
    { id: 'Ventes', label: 'Ventes', icon: <ShoppingBag className="w-5 h-5" strokeWidth={1.75} /> },
    { id: 'Stock', label: 'Stock', icon: <Layers className="w-5 h-5" strokeWidth={1.75} /> },
    { id: 'Menu', label: 'Menu', icon: <MenuIcon className="w-5 h-5" strokeWidth={1.75} /> },
  ];

  const sidebarMenuLinks: Array<{ id: ScreenName; label: string; icon: React.ReactNode }> = [
    { id: 'Historique', label: 'Historique', icon: <History className="w-4 h-4" /> },
    { id: 'Entrees', label: 'Entrées / Achats', icon: <ArrowDownLeft className="w-4 h-4" /> },
    { id: 'Categories', label: 'Catégories', icon: <Tags className="w-4 h-4" /> },
    { id: 'Clients', label: 'Clients', icon: <Users className="w-4 h-4" /> },
    { id: 'Fournisseurs', label: 'Fournisseurs', icon: <Truck className="w-4 h-4" /> },
    { id: 'Recus', label: 'Reçus', icon: <FileText className="w-4 h-4" /> },
    { id: 'Rapports', label: 'Rapports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'Parametres', label: 'Paramètres', icon: <Settings className="w-4 h-4" /> },
  ];

  const isMenuSubScreen = [
    'Menu',
    'Historique',
    'Entrees',
    'Categories',
    'Clients',
    'Fournisseurs',
    'Recus',
    'Rapports',
    'Parametres',
  ].includes(activeScreen);

  return (
    <div className="min-h-screen flex flex-col pt-14 bg-[#F8FAFC] text-[#0F172A]">
      {/* Clean Minimal Fixed Top Bar */}
      <Header
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        isOnline={isOnline}
        onRefresh={async () => {
          await refreshAll(false);
          notify('Synchronisé');
        }}
      />

      {/* Main Workspace Container (Sticky Sidebar on Desktop + Responsive Content Viewport) */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar (No sensitive technical info displayed) */}
        <aside className="hidden md:flex flex-col w-60 lg:w-64 shrink-0 bg-white border-r border-slate-200/90 p-4 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto no-print">
          <div className="space-y-6">
            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 mb-2">
                Navigation principale
              </p>
              <div className="space-y-1">
                {bottomTabs
                  .filter((item) => item.id !== 'Menu')
                  .map((item) => {
                    const isActive = activeScreen === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#047857] text-white'
                            : 'text-slate-700 hover:bg-[#ECFDF5] hover:text-[#047857]'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 mb-2">
                Gestion & Modules
              </p>
              <div className="space-y-1">
                {sidebarMenuLinks.map((item) => {
                  const isActive = activeScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-3 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#ECFDF5] text-[#047857] font-semibold border border-[#A7F3D0]/70'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Scrollable Viewport — Perfectly aligned on Mobile & PC */}
        <main
          className={`flex-1 min-w-0 p-3.5 sm:p-5 lg:p-8 pb-24 md:pb-10 ${
            activeReceiptModal ? 'no-print' : ''
          }`}
        >
          <div className="max-w-[1360px] mx-auto w-full">
            {activeScreen === 'Accueil' && (
              <DashboardScreen
                data={dashboard}
                loading={loading}
                recus={recus}
                onNavigate={handleNavigate}
                onQuickAction={handleQuickAction}
                onOpenReceipt={setActiveReceiptModal}
              />
            )}

            {activeScreen === 'Produits' && (
              <ProductsScreen
                produits={produits}
                categories={categories}
                entrees={entrees}
                sorties={sorties}
                onCreate={async (payload) => {
                  await apiClient.createProduit(payload);
                  notify('Produit ajouté');
                  await refreshAll(true);
                }}
                onUpdate={async (id, payload) => {
                  await apiClient.updateProduit(id, payload);
                  notify('Produit modifié');
                  await refreshAll(true);
                }}
                onDelete={async (id) => {
                  await apiClient.deleteProduit(id);
                  notify('Produit supprimé');
                  await refreshAll(true);
                }}
              />
            )}

            {activeScreen === 'Categories' && (
              <CategoriesScreen
                categories={categories}
                onCreate={async (payload) => {
                  await apiClient.createCategorie(payload);
                  notify('Catégorie ajoutée');
                  await refreshAll(true);
                }}
                onUpdate={async (id, payload) => {
                  await apiClient.updateCategorie(id, payload);
                  notify('Catégorie modifiée');
                  await refreshAll(true);
                }}
                onDelete={async (id) => {
                  await apiClient.deleteCategorie(id);
                  notify('Catégorie supprimée');
                  await refreshAll(true);
                }}
              />
            )}

            {activeScreen === 'Historique' && (
              <HistoryScreen
                entrees={entrees}
                sorties={sorties}
                categories={categories}
                recus={recus}
                onOpenReceipt={setActiveReceiptModal}
                onDeleteEntree={async (id) => {
                  await apiClient.deleteEntree(id);
                  notify('Entrée supprimée');
                  await refreshAll(true);
                }}
                onDeleteSortie={async (id) => {
                  await apiClient.deleteSortie(id);
                  notify('Vente supprimée');
                  await refreshAll(true);
                }}
              />
            )}

            {activeScreen === 'Entrees' && (
              <EntriesScreen
                entrees={entrees}
                produits={produits}
                categories={categories}
                fournisseurs={fournisseurs}
                recus={recus}
                onCreateEntree={async (payload) => {
                  const res = await apiClient.createEntree(payload);
                  notify('Entrée validée');
                  await refreshAll(true);
                  return res.recu || null;
                }}
                onDeleteEntree={async (id) => {
                  await apiClient.deleteEntree(id);
                  notify('Entrée supprimée');
                  await refreshAll(true);
                }}
                onOpenReceipt={setActiveReceiptModal}
              />
            )}

            {activeScreen === 'Ventes' && (
              <SalesScreen
                sorties={sorties}
                produits={produits}
                categories={categories}
                clients={clients}
                recus={recus}
                onCreateSortie={async (payload) => {
                  const res = await apiClient.createSortie(payload);
                  notify('Vente validée');
                  await refreshAll(true);
                  return res.recu || null;
                }}
                onUpdateSortie={async (id, payload) => {
                  const res = await apiClient.updateSortie(id, payload);
                  notify('Vente modifiée');
                  await refreshAll(true);
                  return res.recu || null;
                }}
                onDeleteSortie={async (id) => {
                  await apiClient.deleteSortie(id);
                  notify('Vente supprimée');
                  await refreshAll(true);
                }}
                onOpenReceipt={setActiveReceiptModal}
                onNotifyError={(msg) => notify(msg, 'error')}
              />
            )}

            {activeScreen === 'Stock' && (
              <StockScreen
                stock={stock}
                entrees={entrees}
                produits={produits}
                categories={categories}
                recus={recus}
                onUpdateThreshold={async (produitId, seuil) => {
                  await apiClient.updateStockThreshold(produitId, seuil);
                  notify('Seuil mis à jour');
                  await refreshAll(true);
                }}
                onAddStock={async (payload) => {
                  const targetProd = produits.find(
                    (p) => Number(p.id) === Number(payload.produit_id)
                  );
                  await apiClient.createEntree({
                    produit_id: payload.produit_id,
                    produit_nom: payload.produit_nom,
                    categorie_id: payload.categorie_id,
                    quantite: payload.quantite,
                    prix_unitaire: Number(targetProd?.prix_achat || 0),
                    fournisseur_nom: 'Approvisionnement Stock',
                    fournisseur_contact: '',
                  });
                  notify('Stock ajouté');
                  await refreshAll(true);
                }}
                onOpenReceipt={setActiveReceiptModal}
                onDeleteEntree={async (id) => {
                  await apiClient.deleteEntree(id);
                  notify('Entrée supprimée');
                  await refreshAll(true);
                }}
              />
            )}

            {activeScreen === 'Clients' && (
              <ClientsScreen
                clients={clients}
                onCreate={async (payload) => {
                  await apiClient.createClient(payload);
                  notify('Client ajouté');
                  await refreshAll(true);
                }}
                onUpdate={async (id, payload) => {
                  await apiClient.updateClient(id, payload);
                  notify('Client modifié');
                  await refreshAll(true);
                }}
                onDelete={async (id) => {
                  await apiClient.deleteClient(id);
                  notify('Client supprimé');
                  await refreshAll(true);
                }}
              />
            )}

            {activeScreen === 'Fournisseurs' && (
              <SuppliersScreen
                fournisseurs={fournisseurs}
                onCreate={async (payload) => {
                  await apiClient.createFournisseur(payload);
                  notify('Fournisseur ajouté');
                  await refreshAll(true);
                }}
                onUpdate={async (id, payload) => {
                  await apiClient.updateFournisseur(id, payload);
                  notify('Fournisseur modifié');
                  await refreshAll(true);
                }}
                onDelete={async (id) => {
                  await apiClient.deleteFournisseur(id);
                  notify('Fournisseur supprimé');
                  await refreshAll(true);
                }}
              />
            )}

            {activeScreen === 'Recus' && (
              <ReceiptsScreen
                recus={recus}
                onOpenReceipt={setActiveReceiptModal}
                onDeleteRecu={async (id) => {
                  await apiClient.deleteRecu(id);
                  notify('Reçu supprimé');
                  await refreshAll(true);
                }}
              />
            )}

            {activeScreen === 'Rapports' && <ReportsScreen />}

            {activeScreen === 'Parametres' && (
              <SettingsScreen
                mysqlStatus={mysqlStatus}
                onRefreshAll={() => refreshAll(false)}
                onNotify={notify}
              />
            )}

            {activeScreen === 'Menu' && (
              <MenuScreen
                onNavigate={handleNavigate}
                counts={{
                  historique: entrees.length + sorties.length,
                  entrees: entrees.length,
                  categories: categories.length,
                  clients: clients.length,
                  fournisseurs: fournisseurs.length,
                  recus: recus.length,
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Bouton flottant 'Retour en haut' */}
      <ScrollToTopButton />

      {/* Perfectly Aligned Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center no-print">
        {bottomTabs.map((tab) => {
          const isActive = tab.id === 'Menu' ? isMenuSubScreen : activeScreen === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavigate(tab.id)}
              className={`h-full flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                isActive ? 'text-[#047857]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.icon}
              <span className={`text-[10px] tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Discreet Notification Pill */}
      <div className="fixed top-16 right-3 sm:right-5 z-50 flex flex-col items-end gap-1 pointer-events-none no-print">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => dismissNotification(n.id)}
            className={`pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-xs border backdrop-blur-md text-[11px] font-medium cursor-pointer transition-all ${
              n.type === 'error'
                ? 'bg-red-50/95 border-red-200 text-red-700'
                : n.type === 'info'
                ? 'bg-white/95 border-slate-200 text-slate-700'
                : 'bg-white/95 border-emerald-200/90 text-[#065F46]'
            }`}
          >
            {n.type === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            ) : n.type === 'info' ? (
              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0" />
            )}
            <span className="truncate max-w-[200px]">{n.message}</span>
          </div>
        ))}
      </div>

      {/* Receipt Preview, Print, PDF & Share Modal */}
      <ReceiptModal recu={activeReceiptModal} onClose={() => setActiveReceiptModal(null)} />
    </div>
  );
};
