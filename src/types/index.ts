export type StockStatus = 'EN STOCK' | 'STOCK FAIBLE' | 'RUPTURE';

export type ScreenName =
  | 'Accueil'
  | 'Produits'
  | 'Ventes'
  | 'Stock'
  | 'Menu'
  | 'Historique'
  | 'Entrees'
  | 'Categories'
  | 'Clients'
  | 'Fournisseurs'
  | 'Recus'
  | 'Rapports'
  | 'Parametres';

export interface Categorie {
  id: number;
  nom: string;
  description: string;
  statut: 'Actif' | 'Inactif';
  date_creation: string;
  nombre_produits?: number;
}

export interface Produit {
  id: number;
  nom: string;
  categorie_id: number;
  categorie_nom?: string;
  prix_achat: number;
  prix_vente: number;
  unite: string;
  seuil_alerte: number;
  statut: 'Actif' | 'Inactif';
  date_creation: string;
  stock_disponible: number;
  total_entrees?: number;
  total_sorties?: number;
  stock_statut: StockStatus;
  derniere_mise_a_jour?: string;
}

export interface Entree {
  id: number;
  numero_recu: string;
  categorie_id: number;
  categorie_nom?: string;
  produit_id: number;
  produit_nom?: string;
  unite?: string;
  quantite: number;
  prix_unitaire: number;
  prix_total: number;
  fournisseur_id?: number | null;
  fournisseur_nom: string;
  fournisseur_contact: string;
  date_achat: string;
}

export interface Sortie {
  id: number;
  numero_recu: string;
  categorie_id: number;
  categorie_nom?: string;
  produit_id: number;
  produit_nom?: string;
  unite?: string;
  quantite: number;
  prix_unitaire: number;
  prix_total: number;
  client_id?: number | null;
  client_nom: string;
  client_contact: string;
  date_vente: string;
}

export interface StockItem {
  id: number;
  produit_id: number;
  produit_nom: string;
  categorie_id: number;
  categorie_nom: string;
  prix_achat: number;
  prix_vente: number;
  unite: string;
  quantite_disponible: number;
  total_entrees: number;
  total_sorties: number;
  seuil_alerte: number;
  statut: StockStatus;
  derniere_mise_a_jour: string;
}

export interface Client {
  id: number;
  nom_complet: string;
  telephone: string;
  adresse: string;
  email: string;
  date_ajout: string;
  nombre_achats?: number;
  montant_total?: number;
}

export interface Fournisseur {
  id: number;
  nom_complet: string;
  telephone: string;
  adresse: string;
  email: string;
  date_ajout: string;
  nombre_approvisionnements?: number;
  montant_total?: number;
}

export interface Recu {
  id: number;
  numero_recu: string;
  type_operation: 'VENTE' | 'ENTREE';
  sortie_id?: number | null;
  entree_id?: number | null;
  date_recu: string;
  partenaire_nom: string;
  partenaire_contact: string;
  produit_nom: string;
  categorie_nom: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  prix_total: number;
  total_general: number;
}

export interface VenteMensuelle {
  mois: string;
  mois_label: string;
  mois_court: string;
  volume_quantite: number;
  nombre_ventes: number;
  chiffre_affaires: number;
}

export interface DashboardData {
  database: string;
  engine: string;
  stats: {
    nombre_produits: number;
    quantite_totale_stock: number;
    ventes_jour_nombre: number;
    ventes_jour_montant: number;
    achats_jour_nombre: number;
    achats_jour_montant: number;
    chiffre_affaires: number;
    total_achats: number;
    produits_stock_faible: number;
    produits_en_rupture: number;
  };
  dernieres_ventes: Sortie[];
  dernieres_entrees: Entree[];
  produits_plus_vendus: Array<{
    id: number;
    nom: string;
    unite: string;
    prix_vente: number;
    categorie_nom: string;
    quantite_vendue: number;
    chiffre_affaires: number;
    stock_disponible: number;
  }>;
  produits_stock_faible: StockItem[];
  evolution_ventes_mensuelles?: VenteMensuelle[];
}

export type PeriodeFilter = 'aujourd_hui' | 'semaine' | 'mois' | 'annee' | 'personnalise';

export interface RapportData {
  periode: PeriodeFilter;
  date_debut: string;
  date_fin: string;
  resume: {
    nombre_ventes: number;
    total_ventes: number;
    nombre_achats: number;
    total_achats: number;
    produits_vendus: number;
    produits_achetes: number;
    solde_periode: number;
  };
  ventes: Sortie[];
  achats: Entree[];
  stock: Array<StockItem & { valeur_stock_vente: number; valeur_stock_achat: number }>;
  produits: Array<
    Produit & {
      qte_vendue_periode: number;
      ca_periode: number;
      qte_achetee_periode: number;
      cout_achat_periode: number;
    }
  >;
  clients: Array<Client & { nombre_ventes: number; quantite_totale: number; chiffre_affaires: number }>;
  fournisseurs: Array<Fournisseur & { nombre_achats: number; quantite_totale: number; montant_total: number }>;
}

export interface MySQLTableInfo {
  table_name: string;
  row_count: number;
  primary_key: string;
  foreign_keys: string;
  description: string;
}

export interface MySQLStatusData {
  database: string;
  engine: string;
  charset: string;
  connected: boolean;
  foreign_keys_enabled: boolean;
  total_records: number;
  last_verified: string;
  tables: MySQLTableInfo[];
}

export interface NotificationItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
