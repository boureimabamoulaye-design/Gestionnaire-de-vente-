import {
  Categorie,
  Client,
  DashboardData,
  Entree,
  Fournisseur,
  MySQLStatusData,
  PeriodeFilter,
  Produit,
  RapportData,
  Recu,
  Sortie,
  StockItem,
  VenteMensuelle,
} from '../types';
import { getNowDateTimeString } from '../utils/formatters';

// Nettoyage définitif de tout ancien cache JSON local parallèle
if (typeof window !== 'undefined' && window.localStorage) {
  const legacyKeys = [
    'universkaneprod_local_backup_v1',
    'universkaneprod_local_backup_meta_v1',
    'universkaneprod_offline_queue_v1',
    'universkaneprod_cloud_sync_cfg_v1',
    'universkaneprod_simulated_offline_v1',
  ];
  for (const key of legacyKeys) {
    window.localStorage.removeItem(key);
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Erreur base de données MySQL (${response.status})`);
  }
  return data as T;
}

export const apiClient = {
  // 1. Tableau de bord (connecté directement à MySQL)
  async getDashboard(): Promise<DashboardData> {
    return apiFetch<DashboardData>('/api/dashboard');
  },

  // 2. Produits (connecté directement à la table MySQL `produits` + `stock` + `categories`)
  async getProduits(): Promise<Produit[]> {
    return apiFetch<Produit[]>('/api/produits');
  },

  async createProduit(
    payload: Partial<Produit> & { stock_initial?: number }
  ): Promise<{ message: string; data: Produit }> {
    return apiFetch<{ message: string; data: Produit }>('/api/produits', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProduit(
    id: number,
    payload: Partial<Produit>
  ): Promise<{ message: string; data: Produit }> {
    return apiFetch<{ message: string; data: Produit }>(`/api/produits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteProduit(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/produits/${id}`, {
      method: 'DELETE',
    });
  },

  // 3. Catégories (connecté directement à la table MySQL `categories`)
  async getCategories(): Promise<Categorie[]> {
    return apiFetch<Categorie[]>('/api/categories');
  },

  async createCategorie(
    payload: Partial<Categorie>
  ): Promise<{ message: string; data: Categorie }> {
    return apiFetch<{ message: string; data: Categorie }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCategorie(
    id: number,
    payload: Partial<Categorie>
  ): Promise<{ message: string; data: Categorie }> {
    return apiFetch<{ message: string; data: Categorie }>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteCategorie(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // 4. Entrées / Achats (connecté directement aux tables MySQL `entrees`, `fournisseurs`, `stock`, `recus`)
  async getEntrees(): Promise<Entree[]> {
    return apiFetch<Entree[]>('/api/entrees');
  },

  async createEntree(payload: {
    produit_id: number;
    produit_nom?: string;
    unite?: string;
    categorie_id?: number;
    quantite: number;
    prix_unitaire: number;
    fournisseur_id?: number | null;
    fournisseur_nom: string;
    fournisseur_contact: string;
    date_achat?: string;
  }): Promise<{ message: string; stock_message: string; data: Entree; recu: Recu }> {
    return apiFetch<{ message: string; stock_message: string; data: Entree; recu: Recu }>(
      '/api/entrees',
      {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          date_achat: payload.date_achat || getNowDateTimeString(),
        }),
      }
    );
  },

  async deleteEntree(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/entrees/${id}`, {
      method: 'DELETE',
    });
  },

  // 5. Ventes / Sorties (connecté directement aux tables MySQL `sorties`, `clients`, `stock`, `recus`)
  async getSorties(): Promise<Sortie[]> {
    return apiFetch<Sortie[]>('/api/sorties');
  },

  async createSortie(payload: {
    produit_id: number;
    categorie_id?: number;
    quantite: number;
    prix_unitaire: number;
    client_id?: number | null;
    client_nom: string;
    client_contact: string;
    date_vente?: string;
  }): Promise<{ message: string; stock_message: string; data: Sortie; recu: Recu }> {
    return apiFetch<{ message: string; stock_message: string; data: Sortie; recu: Recu }>(
      '/api/sorties',
      {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          date_vente: payload.date_vente || getNowDateTimeString(),
        }),
      }
    );
  },

  async updateSortie(
    id: number,
    payload: {
      produit_id: number;
      categorie_id?: number;
      quantite: number;
      prix_unitaire: number;
      client_id?: number | null;
      client_nom: string;
      client_contact: string;
    }
  ): Promise<{ message: string; data: Sortie; recu: Recu }> {
    return apiFetch<{ message: string; data: Sortie; recu: Recu }>(`/api/sorties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteSortie(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/sorties/${id}`, {
      method: 'DELETE',
    });
  },

  // 6. Stock (connecté directement à la table MySQL `stock`)
  async getStock(): Promise<StockItem[]> {
    return apiFetch<StockItem[]>('/api/stock');
  },

  async updateStockThreshold(
    produitId: number,
    seuil_alerte: number
  ): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/stock/${produitId}`, {
      method: 'PUT',
      body: JSON.stringify({ seuil_alerte }),
    });
  },

  // 7. Clients (connecté directement à la table MySQL `clients` et relation `sorties`)
  async getClients(): Promise<Client[]> {
    return apiFetch<Client[]>('/api/clients');
  },

  async getClientHistory(id: number): Promise<{ client: Client; ventes: Sortie[] }> {
    return apiFetch<{ client: Client; ventes: Sortie[] }>(`/api/clients/${id}/historique`);
  },

  async createClient(payload: Partial<Client>): Promise<{ message: string; data: Client }> {
    return apiFetch<{ message: string; data: Client }>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateClient(
    id: number,
    payload: Partial<Client>
  ): Promise<{ message: string; data: Client }> {
    return apiFetch<{ message: string; data: Client }>(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteClient(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/clients/${id}`, {
      method: 'DELETE',
    });
  },

  // 8. Fournisseurs (connecté directement à la table MySQL `fournisseurs` et relation `entrees`)
  async getFournisseurs(): Promise<Fournisseur[]> {
    return apiFetch<Fournisseur[]>('/api/fournisseurs');
  },

  async getFournisseurHistory(
    id: number
  ): Promise<{ fournisseur: Fournisseur; achats: Entree[] }> {
    return apiFetch<{ fournisseur: Fournisseur; achats: Entree[] }>(
      `/api/fournisseurs/${id}/historique`
    );
  },

  async createFournisseur(
    payload: Partial<Fournisseur>
  ): Promise<{ message: string; data: Fournisseur }> {
    return apiFetch<{ message: string; data: Fournisseur }>('/api/fournisseurs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateFournisseur(
    id: number,
    payload: Partial<Fournisseur>
  ): Promise<{ message: string; data: Fournisseur }> {
    return apiFetch<{ message: string; data: Fournisseur }>(`/api/fournisseurs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteFournisseur(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/fournisseurs/${id}`, {
      method: 'DELETE',
    });
  },

  // 9. Reçus (connecté directement à la table MySQL `recus`)
  async getRecus(): Promise<Recu[]> {
    return apiFetch<Recu[]>('/api/recus');
  },

  async deleteRecu(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/recus/${id}`, {
      method: 'DELETE',
    });
  },

  // 10. Évolution du volume des ventes (6 derniers mois depuis MySQL)
  async getVentesMensuelles(): Promise<VenteMensuelle[]> {
    return apiFetch<VenteMensuelle[]>('/api/stats/ventes-mensuelles');
  },

  // 11. Rapports (calculés en direct par requêtes SQL sur la base MySQL)
  async getRapports(
    periode: PeriodeFilter,
    date_debut?: string,
    date_fin?: string
  ): Promise<RapportData> {
    const params = new URLSearchParams({ periode });
    if (date_debut) params.set('date_debut', date_debut);
    if (date_fin) params.set('date_fin', date_fin);
    return apiFetch<RapportData>(`/api/rapports?${params.toString()}`);
  },

  // 11. Diagnostic, Vérification & Export SQL de la base MySQL unique
  async getMySQLStatus(): Promise<MySQLStatusData> {
    return apiFetch<MySQLStatusData>('/api/mysql/status');
  },

  async verifyAndSyncMySQL(): Promise<{ message: string; status: MySQLStatusData }> {
    return apiFetch<{ message: string; status: MySQLStatusData }>('/api/mysql/verify', {
      method: 'POST',
    });
  },

  async getMySQLTableRows(
    tableName: string
  ): Promise<{ table: string; count: number; rows: Record<string, any>[] }> {
    return apiFetch<{ table: string; count: number; rows: Record<string, any>[] }>(
      `/api/mysql/table/${encodeURIComponent(tableName)}`
    );
  },

  async getSqlExportScript(): Promise<string> {
    const res = await fetch('/api/sql-schema');
    if (!res.ok) {
      throw new Error('Erreur lors de la génération du script SQL MySQL.');
    }
    return res.text();
  },

  async resetDatabase(): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/reset', { method: 'POST' });
  },
};
