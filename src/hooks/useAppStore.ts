import { useCallback, useEffect, useState } from 'react';
import {
  Categorie,
  Client,
  DashboardData,
  Entree,
  Fournisseur,
  MySQLStatusData,
  NotificationItem,
  Produit,
  Recu,
  Sortie,
  StockItem,
} from '../types';
import { apiClient } from '../api/client';
import { useOnlineStatus } from './useOnlineStatus';

export function useAppStore() {
  const { isOnline } = useOnlineStatus();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [sorties, setSorties] = useState<Sortie[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [recus, setRecus] = useState<Recu[]>([]);
  const [mysqlStatus, setMysqlStatus] = useState<MySQLStatusData | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeReceiptModal, setActiveReceiptModal] = useState<Recu | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setNotifications([{ id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 1400);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const refreshAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [
        dashData,
        prodData,
        catData,
        entData,
        sortData,
        stkData,
        cliData,
        fourData,
        recData,
        dbStatus,
      ] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getProduits(),
        apiClient.getCategories(),
        apiClient.getEntrees(),
        apiClient.getSorties(),
        apiClient.getStock(),
        apiClient.getClients(),
        apiClient.getFournisseurs(),
        apiClient.getRecus(),
        apiClient.getMySQLStatus(),
      ]);

      setDashboard(dashData);
      setProduits(prodData);
      setCategories(catData);
      setEntrees(entData);
      setSorties(sortData);
      setStock(stkData);
      setClients(cliData);
      setFournisseurs(fourData);
      setRecus(recData);
      setMysqlStatus(dbStatus);
    } catch (err: any) {
      setError(err?.message || 'Erreur de connexion à la base de données MySQL.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll, isOnline]);

  return {
    loading,
    error,
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
  };
}
