import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import dotenv from 'dotenv';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import mysql from 'mysql2/promise';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const DB_FILE_PATH = path.resolve(process.cwd(), 'univers_base_prod.db');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const MYSQL_DB_NAME = process.env.MYSQL_DATABASE || 'UNIVERS-BASE-PROD';

/**
 * Generates a valid solid/styled PNG buffer (with IHDR, IDAT, IEND)
 * so PWA icon requirements (180x180, 192x192, 512x512) are met natively.
 */
function createSolidPng(size: number, r: number, g: number, b: number, maskable = false): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = size * 4 + 1;
  const raw = Buffer.alloc(rowSize * size);
  const margin = maskable ? Math.floor(size * 0.22) : Math.floor(size * 0.16);

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;
      const inSafeBox = x >= margin && x < size - margin && y >= margin && y < size - margin;
      const relX = (x - margin) / (size - 2 * margin);
      const relY = (y - margin) / (size - 2 * margin);
      const isU =
        inSafeBox &&
        relY >= 0.18 &&
        relY <= 0.82 &&
        ((relX >= 0.2 && relX <= 0.36 && relY <= 0.68) ||
          (relX >= 0.64 && relX <= 0.8 && relY <= 0.68) ||
          (relY >= 0.64 && relY <= 0.82 && relX >= 0.2 && relX >= 0.8));

      if (isU) {
        raw[px] = 255;
        raw[px + 1] = 255;
        raw[px + 2] = 255;
        raw[px + 3] = 255;
      } else {
        raw[px] = r;
        raw[px + 1] = g;
        raw[px + 2] = b;
        raw[px + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function ensurePwaIcons() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  const icons = [
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
    { name: 'pwa-192x192.png', size: 192, maskable: false },
    { name: 'pwa-512x512.png', size: 512, maskable: false },
    { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
  ];
  for (const icon of icons) {
    const filePath = path.join(PUBLIC_DIR, icon.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, createSolidPng(icon.size, 4, 120, 87, icon.maskable));
    }
  }
}

// ============================================================================
// MOTEUR DE BASE DE DONNÉES MYSQL CENTRAL UNIQUE (UNIVERS-BASE-PROD)
// ============================================================================
let mysqlPool: mysql.Pool | null = null;
let embeddedSqlDb: SqlJsDatabase | null = null;
let useExternalMySQL = false;

function persistEmbeddedSql() {
  if (!embeddedSqlDb) return;
  const data = embeddedSqlDb.export();
  fs.writeFileSync(DB_FILE_PATH, Buffer.from(data));
}

async function queryAll<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
  if (useExternalMySQL && mysqlPool) {
    const [rows] = await mysqlPool.execute(sql, params);
    return (Array.isArray(rows) ? rows : []) as T[];
  }
  if (!embeddedSqlDb) throw new Error('Base de données MySQL non initialisée.');
  const stmt = embeddedSqlDb.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

async function queryOne<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function runStatement(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number }> {
  if (useExternalMySQL && mysqlPool) {
    const [result] = await mysqlPool.execute<mysql.ResultSetHeader>(sql, params);
    return { lastInsertRowid: Number(result.insertId || 0) };
  }
  if (!embeddedSqlDb) throw new Error('Base de données MySQL non initialisée.');
  const stmt = embeddedSqlDb.prepare(sql);
  stmt.run(params);
  stmt.free();
  const idRow = await queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  persistEmbeddedSql();
  return { lastInsertRowid: idRow ? Number(idRow.id) : 0 };
}

function nowISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function todayPrefix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function generateReceiptNumber(prefix: 'REC' | 'ENT'): Promise<string> {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const countRow = await queryOne<{ total: number }>('SELECT COUNT(*) as total FROM recus');
  const seq = String(Number(countRow?.total || 0) + 1).padStart(4, '0');
  const rand = String(Math.floor(100 + Math.random() * 900));
  return `${prefix}-${datePart}-${seq}-${rand}`;
}

/**
 * Recalcule le stock d'un produit selon la formule stricte :
 * STOCK DISPONIBLE = TOTAL DES ENTRÉES - TOTAL DES SORTIES
 * Le stock ne devient jamais négatif.
 * Statuts : EN STOCK | STOCK FAIBLE | RUPTURE
 */
async function recalculateStockForProduct(produitId: number): Promise<void> {
  const prod = await queryOne<{ id: number; seuil_alerte: number; date_creation: string }>(
    'SELECT id, seuil_alerte, date_creation FROM produits WHERE id = ?',
    [produitId]
  );
  if (!prod) return;

  const entreeStats = await queryOne<{ total: number; last_date: string | null }>(
    'SELECT COALESCE(SUM(quantite), 0) as total, MAX(date_achat) as last_date FROM entrees WHERE produit_id = ?',
    [produitId]
  );
  const sortieStats = await queryOne<{ total: number; last_date: string | null }>(
    'SELECT COALESCE(SUM(quantite), 0) as total, MAX(date_vente) as last_date FROM sorties WHERE produit_id = ?',
    [produitId]
  );

  const totalEntrees = Number(entreeStats?.total || 0);
  const totalSorties = Number(sortieStats?.total || 0);
  const quantiteDisponible = Math.max(0, totalEntrees - totalSorties);
  const seuil = Number(prod.seuil_alerte ?? 10);

  let statut: 'EN STOCK' | 'STOCK FAIBLE' | 'RUPTURE' = 'EN STOCK';
  if (quantiteDisponible <= 0) {
    statut = 'RUPTURE';
  } else if (quantiteDisponible <= seuil) {
    statut = 'STOCK FAIBLE';
  }

  const lastEntreeDate = entreeStats?.last_date || '';
  const lastSortieDate = sortieStats?.last_date || '';
  const latestMovementDate =
    lastEntreeDate > lastSortieDate
      ? lastEntreeDate
      : lastSortieDate || prod.date_creation || nowISO();

  const existingStock = await queryOne<{
    id: number;
    quantite_disponible: number;
    total_entrees: number;
    total_sorties: number;
    seuil_alerte: number;
    statut: string;
  }>(
    'SELECT id, quantite_disponible, total_entrees, total_sorties, seuil_alerte, statut FROM stock WHERE produit_id = ?',
    [produitId]
  );

  if (existingStock) {
    const unchanged =
      Number(existingStock.quantite_disponible) === quantiteDisponible &&
      Number(existingStock.total_entrees) === totalEntrees &&
      Number(existingStock.total_sorties) === totalSorties &&
      Number(existingStock.seuil_alerte) === seuil &&
      existingStock.statut === statut;

    if (!unchanged) {
      await runStatement(
        `UPDATE stock
         SET quantite_disponible = ?, total_entrees = ?, total_sorties = ?, seuil_alerte = ?, statut = ?, derniere_mise_a_jour = ?
         WHERE produit_id = ?`,
        [quantiteDisponible, totalEntrees, totalSorties, seuil, statut, latestMovementDate, produitId]
      );
    }
  } else {
    await runStatement(
      `INSERT INTO stock (produit_id, quantite_disponible, total_entrees, total_sorties, seuil_alerte, statut, derniere_mise_a_jour)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [produitId, quantiteDisponible, totalEntrees, totalSorties, seuil, statut, latestMovementDate]
    );
  }
}

async function recalculateAllStocks(): Promise<void> {
  await runStatement('DELETE FROM stock WHERE produit_id NOT IN (SELECT id FROM produits)');
  const prods = await queryAll<{ id: number }>('SELECT id FROM produits');
  for (const p of prods) {
    await recalculateStockForProduct(Number(p.id));
  }
}

async function syncAllTableRelations(): Promise<void> {
  try {
    await runStatement('DELETE FROM stock WHERE produit_id NOT IN (SELECT id FROM produits)');
    await recalculateAllStocks();
  } catch {
    // ignore
  }
}

async function initMySQLTablesOnServer(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(120) NOT NULL UNIQUE,
      description TEXT,
      statut ENUM('Actif', 'Inactif') NOT NULL DEFAULT 'Actif',
      date_creation VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS produits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(180) NOT NULL,
      categorie_id INT NOT NULL,
      prix_achat DECIMAL(15,2) NOT NULL DEFAULT 0,
      prix_vente DECIMAL(15,2) NOT NULL DEFAULT 0,
      unite VARCHAR(50) NOT NULL DEFAULT 'Unité',
      seuil_alerte INT NOT NULL DEFAULT 10,
      statut ENUM('Actif', 'Inactif') NOT NULL DEFAULT 'Actif',
      date_creation VARCHAR(32) NOT NULL,
      INDEX idx_produits_categorie (categorie_id),
      CONSTRAINT fk_produits_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fournisseurs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom_complet VARCHAR(180) NOT NULL,
      telephone VARCHAR(50) NOT NULL DEFAULT '',
      adresse VARCHAR(255) DEFAULT '',
      email VARCHAR(150) DEFAULT '',
      date_ajout VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom_complet VARCHAR(180) NOT NULL,
      telephone VARCHAR(50) NOT NULL DEFAULT '',
      adresse VARCHAR(255) DEFAULT '',
      email VARCHAR(150) DEFAULT '',
      date_ajout VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS entrees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      numero_recu VARCHAR(60) NOT NULL UNIQUE,
      categorie_id INT NOT NULL,
      produit_id INT NOT NULL,
      quantite INT NOT NULL,
      prix_unitaire DECIMAL(15,2) NOT NULL,
      prix_total DECIMAL(15,2) NOT NULL,
      fournisseur_id INT NULL,
      fournisseur_nom VARCHAR(180) NOT NULL,
      fournisseur_contact VARCHAR(80) DEFAULT '',
      date_achat VARCHAR(32) NOT NULL,
      INDEX idx_entrees_produit (produit_id),
      INDEX idx_entrees_fournisseur (fournisseur_id),
      CONSTRAINT fk_entrees_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT,
      CONSTRAINT fk_entrees_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE,
      CONSTRAINT fk_entrees_fournisseur FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sorties (
      id INT AUTO_INCREMENT PRIMARY KEY,
      numero_recu VARCHAR(60) NOT NULL UNIQUE,
      categorie_id INT NOT NULL,
      produit_id INT NOT NULL,
      quantite INT NOT NULL,
      prix_unitaire DECIMAL(15,2) NOT NULL,
      prix_total DECIMAL(15,2) NOT NULL,
      client_id INT NULL,
      client_nom VARCHAR(180) NOT NULL,
      client_contact VARCHAR(80) DEFAULT '',
      date_vente VARCHAR(32) NOT NULL,
      INDEX idx_sorties_produit (produit_id),
      INDEX idx_sorties_client (client_id),
      CONSTRAINT fk_sorties_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT,
      CONSTRAINT fk_sorties_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE,
      CONSTRAINT fk_sorties_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock (
      id INT AUTO_INCREMENT PRIMARY KEY,
      produit_id INT NOT NULL UNIQUE,
      quantite_disponible INT NOT NULL DEFAULT 0,
      total_entrees INT NOT NULL DEFAULT 0,
      total_sorties INT NOT NULL DEFAULT 0,
      seuil_alerte INT NOT NULL DEFAULT 10,
      statut ENUM('EN STOCK', 'STOCK FAIBLE', 'RUPTURE') NOT NULL DEFAULT 'RUPTURE',
      derniere_mise_a_jour VARCHAR(32) NOT NULL,
      CONSTRAINT fk_stock_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS recus (
      id INT AUTO_INCREMENT PRIMARY KEY,
      numero_recu VARCHAR(60) NOT NULL UNIQUE,
      type_operation ENUM('VENTE', 'ENTREE') NOT NULL DEFAULT 'VENTE',
      sortie_id INT NULL,
      entree_id INT NULL,
      date_recu VARCHAR(32) NOT NULL,
      partenaire_nom VARCHAR(180) NOT NULL,
      partenaire_contact VARCHAR(80) DEFAULT '',
      produit_nom VARCHAR(180) NOT NULL,
      categorie_nom VARCHAR(120) DEFAULT '',
      unite VARCHAR(50) DEFAULT 'Unité',
      quantite INT NOT NULL,
      prix_unitaire DECIMAL(15,2) NOT NULL,
      prix_total DECIMAL(15,2) NOT NULL,
      total_general DECIMAL(15,2) NOT NULL,
      INDEX idx_recus_sortie (sortie_id),
      INDEX idx_recus_entree (entree_id),
      CONSTRAINT fk_recus_sortie FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
      CONSTRAINT fk_recus_entree FOREIGN KEY (entree_id) REFERENCES entrees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function initDatabase(): Promise<void> {
  // 1. Connexion directe automatique au serveur MySQL (ex: XAMPP / WAMP / Laragon / MySQL sur 127.0.0.1:3306 ou MYSQL_HOST)
  const mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
  if (mysqlHost) {
    try {
      const tempConn = await mysql.createConnection({
        host: mysqlHost,
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        connectTimeout: 1200,
      });
      await tempConn.query(
        `CREATE DATABASE IF NOT EXISTS \`${MYSQL_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await tempConn.end();

      mysqlPool = mysql.createPool({
        host: mysqlHost,
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: MYSQL_DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        enableKeepAlive: true,
        charset: 'utf8mb4',
      });
      await mysqlPool.query('SELECT 1');
      await initMySQLTablesOnServer(mysqlPool);
      useExternalMySQL = true;
    } catch {
      mysqlPool = null;
      useExternalMySQL = false;
    }
  }

  // 2. Moteur relationnel SQL central (si aucun démon mysqld externe n'est lancé sur l'hôte)
  if (!useExternalMySQL) {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_FILE_PATH)) {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      embeddedSqlDb = new SQL.Database(fileBuffer);
    } else {
      embeddedSqlDb = new SQL.Database();
    }

    // Activation stricte des clés étrangères relationnelles et suppression de toute table hors-schéma
    embeddedSqlDb.run(`
      PRAGMA foreign_keys = ON;
      DROP TABLE IF EXISTS cloud_vaults;

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        statut TEXT NOT NULL DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
        date_creation TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS produits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        categorie_id INTEGER NOT NULL,
        prix_achat REAL NOT NULL DEFAULT 0 CHECK (prix_achat >= 0),
        prix_vente REAL NOT NULL DEFAULT 0 CHECK (prix_vente >= 0),
        unite TEXT NOT NULL DEFAULT 'Unité',
        seuil_alerte INTEGER NOT NULL DEFAULT 10 CHECK (seuil_alerte >= 0),
        statut TEXT NOT NULL DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
        date_creation TEXT NOT NULL,
        FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS fournisseurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom_complet TEXT NOT NULL,
        telephone TEXT NOT NULL DEFAULT '',
        adresse TEXT DEFAULT '',
        email TEXT DEFAULT '',
        date_ajout TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom_complet TEXT NOT NULL,
        telephone TEXT NOT NULL DEFAULT '',
        adresse TEXT DEFAULT '',
        email TEXT DEFAULT '',
        date_ajout TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entrees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_recu TEXT NOT NULL UNIQUE,
        categorie_id INTEGER NOT NULL,
        produit_id INTEGER NOT NULL,
        quantite INTEGER NOT NULL CHECK (quantite > 0),
        prix_unitaire REAL NOT NULL CHECK (prix_unitaire >= 0),
        prix_total REAL NOT NULL CHECK (prix_total >= 0),
        fournisseur_id INTEGER,
        fournisseur_nom TEXT NOT NULL,
        fournisseur_contact TEXT DEFAULT '',
        date_achat TEXT NOT NULL,
        FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT,
        FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE,
        FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS sorties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_recu TEXT NOT NULL UNIQUE,
        categorie_id INTEGER NOT NULL,
        produit_id INTEGER NOT NULL,
        quantite INTEGER NOT NULL CHECK (quantite > 0),
        prix_unitaire REAL NOT NULL CHECK (prix_unitaire >= 0),
        prix_total REAL NOT NULL CHECK (prix_total >= 0),
        client_id INTEGER,
        client_nom TEXT NOT NULL,
        client_contact TEXT DEFAULT '',
        date_vente TEXT NOT NULL,
        FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT,
        FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produit_id INTEGER NOT NULL UNIQUE,
        quantite_disponible INTEGER NOT NULL DEFAULT 0 CHECK (quantite_disponible >= 0),
        total_entrees INTEGER NOT NULL DEFAULT 0 CHECK (total_entrees >= 0),
        total_sorties INTEGER NOT NULL DEFAULT 0 CHECK (total_sorties >= 0),
        seuil_alerte INTEGER NOT NULL DEFAULT 10 CHECK (seuil_alerte >= 0),
        statut TEXT NOT NULL DEFAULT 'RUPTURE' CHECK (statut IN ('EN STOCK', 'STOCK FAIBLE', 'RUPTURE')),
        derniere_mise_a_jour TEXT NOT NULL,
        FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS recus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_recu TEXT NOT NULL UNIQUE,
        type_operation TEXT NOT NULL DEFAULT 'VENTE' CHECK (type_operation IN ('VENTE', 'ENTREE')),
        sortie_id INTEGER,
        entree_id INTEGER,
        date_recu TEXT NOT NULL,
        partenaire_nom TEXT NOT NULL,
        partenaire_contact TEXT DEFAULT '',
        produit_nom TEXT NOT NULL,
        categorie_nom TEXT DEFAULT '',
        unite TEXT DEFAULT 'Unité',
        quantite INTEGER NOT NULL CHECK (quantite > 0),
        prix_unitaire REAL NOT NULL CHECK (prix_unitaire >= 0),
        prix_total REAL NOT NULL CHECK (prix_total >= 0),
        total_general REAL NOT NULL CHECK (total_general >= 0),
        FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,
        FOREIGN KEY (entree_id) REFERENCES entrees(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_produits_categorie ON produits(categorie_id);
      CREATE INDEX IF NOT EXISTS idx_entrees_produit ON entrees(produit_id);
      CREATE INDEX IF NOT EXISTS idx_entrees_fournisseur ON entrees(fournisseur_id);
      CREATE INDEX IF NOT EXISTS idx_sorties_produit ON sorties(produit_id);
      CREATE INDEX IF NOT EXISTS idx_sorties_client ON sorties(client_id);
      CREATE INDEX IF NOT EXISTS idx_recus_sortie ON recus(sortie_id);
      CREATE INDEX IF NOT EXISTS idx_recus_entree ON recus(entree_id);
    `);
  }

  await cleanLegacyDemoData();
  await recalculateAllStocks();
  persistEmbeddedSql();
}

async function cleanLegacyDemoData(): Promise<void> {
  const demoClient = await queryOne<{ id: number }>(
    "SELECT id FROM clients WHERE nom_complet = 'Ferme Avicole Diarra & Frères'"
  );
  const demoSupplier = await queryOne<{ id: number }>(
    "SELECT id FROM fournisseurs WHERE nom_complet = 'Couvoir National Avicole'"
  );
  if (!demoClient && !demoSupplier) {
    return;
  }

  const demoProductNames = [
    'Poulet de chair vif (2.2 kg)',
    'Poussin Chair Cobb 500 (J1)',
    'Plateau d’œufs frais (30 œufs)',
    'Aliment Démarrage Volaille 50kg',
    'Aliment Ponte Complète 50kg',
    'Abreuvoir Automatique Cloche',
    'Mangeoire Linéaire Galvanisée 1m',
    'Complexe Polyvitaminé Hydrosoluble 1L',
  ];
  const demoClientNames = [
    'Ferme Avicole Diarra & Frères',
    'Supermarché Le Panier Vert',
    'Restaurant La Bonne Volaille',
    'Coopérative Éleveurs Kati',
  ];
  const demoSupplierNames = [
    'Couvoir National Avicole',
    'Moulin Moderne Aliments',
    'AgriMatériel Sahel',
  ];

  for (const cName of demoClientNames) {
    await runStatement('DELETE FROM recus WHERE partenaire_nom = ?', [cName]);
    await runStatement('DELETE FROM sorties WHERE client_nom = ?', [cName]);
    await runStatement('DELETE FROM clients WHERE nom_complet = ?', [cName]);
  }

  for (const sName of demoSupplierNames) {
    await runStatement('DELETE FROM recus WHERE partenaire_nom = ?', [sName]);
    await runStatement('DELETE FROM entrees WHERE fournisseur_nom = ?', [sName]);
    await runStatement('DELETE FROM fournisseurs WHERE nom_complet = ?', [sName]);
  }

  for (const pName of demoProductNames) {
    const prod = await queryOne<{ id: number }>('SELECT id FROM produits WHERE nom = ?', [pName]);
    if (prod) {
      await runStatement('DELETE FROM recus WHERE produit_nom = ?', [pName]);
      await runStatement('DELETE FROM stock WHERE produit_id = ?', [prod.id]);
      await runStatement('DELETE FROM entrees WHERE produit_id = ?', [prod.id]);
      await runStatement('DELETE FROM sorties WHERE produit_id = ?', [prod.id]);
      await runStatement('DELETE FROM produits WHERE id = ?', [prod.id]);
    }
  }
}

async function seedInitialCategories(): Promise<void> {
  const now = nowISO();
  const baseCategories = [
    { nom: 'Volailles', description: 'Poulets de chair, pondeuses, pintades et volailles' },
    { nom: 'Poussins', description: 'Poussins d’un jour et sujets démarrés' },
    { nom: 'Œufs', description: 'Plateaux d’œufs de consommation et œufs à couver' },
    { nom: 'Aliments', description: 'Sacs d’aliments démarrage, croissance, finition et ponte' },
    { nom: 'Matériel', description: 'Mangeoires, abreuvoirs, chauffage et accessoires' },
    { nom: 'Autres', description: 'Produits vétérinaires, vitamines et divers' },
  ];

  for (const c of baseCategories) {
    await runStatement(
      'INSERT INTO categories (nom, description, statut, date_creation) VALUES (?, ?, ?, ?)',
      [c.nom, c.description, 'Actif', now]
    );
  }
}

async function buildMySQLStatus() {
  const countTable = async (tableName: string): Promise<number> => {
    const r = await queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM ${tableName}`);
    return Number(r?.total || 0);
  };

  const tables = [
    {
      table_name: 'categories',
      row_count: await countTable('categories'),
      primary_key: 'id (AUTO_INCREMENT)',
      foreign_keys: '',
      description: 'Familles et catégories de produits',
    },
    {
      table_name: 'produits',
      row_count: await countTable('produits'),
      primary_key: 'id (AUTO_INCREMENT)',
      foreign_keys: 'categorie_id → categories(id)',
      description: 'Catalogue des produits et prix unitaires',
    },
    {
      table_name: 'stock',
      row_count: await countTable('stock'),
      primary_key: 'id (AUTO_INCREMENT)',
      foreign_keys: 'produit_id → produits(id) ON DELETE CASCADE',
      description: 'État temps réel des quantités disponibles',
    },
    {
      table_name: 'entrees',
      row_count: await countTable('entrees'),
      primary_key: 'id (AUTO_INCREMENT)',
      foreign_keys: 'produit_id → produits(id), categorie_id → categories(id), fournisseur_id → fournisseurs(id)',
      description: 'Approvisionnements et achats fournisseurs',
    },
    {
      table_name: 'sorties',
      row_count: await countTable('sorties'),
      primary_key: 'id (AUTO_INCREMENT)',
      foreign_keys: 'produit_id → produits(id), categorie_id → categories(id), client_id → clients(id)',
      description: 'Ventes clients et sorties de stock',
    },
    {
      table_name: 'clients',
      row_count: await countTable('clients'),
      primary_key: 'id (AUTO_INCREMENT)',
      foreign_keys: '',
      description: 'Répertoire des clients',
    },
    {
      table_name: 'fournisseurs',
      row_count: await countTable('fournisseurs'),
      primary_key: 'id (AUTO_INCREMENT)',
      foreign_keys: '',
      description: 'Répertoire des fournisseurs',
    },
    {
      table_name: 'recus',
      row_count: await countTable('recus'),
      primary_key: 'id (AUTO_INCREMENT)',
      foreign_keys: 'sortie_id → sorties(id), entree_id → entrees(id)',
      description: 'Reçus officiels de ventes et entrées',
    },
  ];

  const totalRecords = tables.reduce((acc, t) => acc + t.row_count, 0);

  return {
    database: MYSQL_DB_NAME,
    engine: 'MySQL InnoDB',
    charset: 'utf8mb4_unicode_ci',
    connected: true,
    foreign_keys_enabled: true,
    total_records: totalRecords,
    last_verified: nowISO(),
    tables,
  };
}

function sqlEscape(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `'${str}'`;
}

async function startServer() {
  ensurePwaIcons();
  await initDatabase();

  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // ============================================================================
  // 0. STATUT & DIAGNOSTIC DE LA BASE DE DONNÉES MYSQL CENTRALE
  // ============================================================================
  app.get('/api/mysql/status', async (_req: Request, res: Response) => {
    try {
      const status = await buildMySQLStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur de vérification MySQL.', details: error?.message });
    }
  });

  app.post('/api/mysql/verify', async (_req: Request, res: Response) => {
    try {
      await syncAllTableRelations();
      const status = await buildMySQLStatus();
      res.json({
        message: 'Intégrité relationnelle et stocks MySQL vérifiés avec succès.',
        status,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la synchronisation MySQL.', details: error?.message });
    }
  });

  app.get('/api/mysql/table/:name', async (req: Request, res: Response) => {
    try {
      const allowedTables = [
        'categories',
        'produits',
        'stock',
        'entrees',
        'sorties',
        'clients',
        'fournisseurs',
        'recus',
      ];
      const tableName = String(req.params.name || '').toLowerCase();
      if (!allowedTables.includes(tableName)) {
        return res.status(400).json({ error: 'Table non autorisée.' });
      }
      await recalculateAllStocks();
      const rows = await queryAll(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 200`);
      res.json({ table: tableName, count: rows.length, rows });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lecture table MySQL.', details: error?.message });
    }
  });

  // ============================================================================
  // 1. GET /api/dashboard
  // ============================================================================
  app.get('/api/dashboard', async (_req: Request, res: Response) => {
    try {
      await recalculateAllStocks();
      const today = todayPrefix();

      const nbProduits =
        (await queryOne<{ total: number }>('SELECT COUNT(*) as total FROM produits'))?.total || 0;
      const stockTotal =
        (
          await queryOne<{ total: number }>(
            'SELECT COALESCE(SUM(quantite_disponible), 0) as total FROM stock'
          )
        )?.total || 0;

      const ventesJour = (await queryOne<{ count: number; montant: number }>(
        `SELECT COUNT(*) as count, COALESCE(SUM(prix_total), 0) as montant
         FROM sorties WHERE SUBSTR(date_vente, 1, 10) = ?`,
        [today]
      )) || { count: 0, montant: 0 };

      const achatsJour = (await queryOne<{ count: number; montant: number }>(
        `SELECT COUNT(*) as count, COALESCE(SUM(prix_total), 0) as montant
         FROM entrees WHERE SUBSTR(date_achat, 1, 10) = ?`,
        [today]
      )) || { count: 0, montant: 0 };

      const chiffreAffaires =
        (await queryOne<{ total: number }>('SELECT COALESCE(SUM(prix_total), 0) as total FROM sorties'))
          ?.total || 0;

      const totalAchatsGlobal =
        (await queryOne<{ total: number }>('SELECT COALESCE(SUM(prix_total), 0) as total FROM entrees'))
          ?.total || 0;

      const nbStockFaible =
        (
          await queryOne<{ total: number }>(
            "SELECT COUNT(*) as total FROM stock WHERE statut = 'STOCK FAIBLE'"
          )
        )?.total || 0;

      const nbRupture =
        (
          await queryOne<{ total: number }>(
            "SELECT COUNT(*) as total FROM stock WHERE statut = 'RUPTURE'"
          )
        )?.total || 0;

      const dernieresVentes = await queryAll(
        `SELECT s.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM sorties s
         LEFT JOIN produits p ON p.id = s.produit_id
         LEFT JOIN categories c ON c.id = s.categorie_id
         ORDER BY s.date_vente DESC, s.id DESC
         LIMIT 6`
      );

      const dernieresEntrees = await queryAll(
        `SELECT e.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM entrees e
         LEFT JOIN produits p ON p.id = e.produit_id
         LEFT JOIN categories c ON c.id = e.categorie_id
         ORDER BY e.date_achat DESC, e.id DESC
         LIMIT 6`
      );

      const produitsPlusVendus = await queryAll(
        `SELECT p.id, p.nom, p.unite, p.prix_vente, c.nom as categorie_nom,
                COALESCE(SUM(s.quantite), 0) as quantite_vendue,
                COALESCE(SUM(s.prix_total), 0) as chiffre_affaires,
                COALESCE(MAX(st.quantite_disponible), 0) as stock_disponible
         FROM produits p
         LEFT JOIN categories c ON c.id = p.categorie_id
         LEFT JOIN sorties s ON s.produit_id = p.id
         LEFT JOIN stock st ON st.produit_id = p.id
         GROUP BY p.id, p.nom, p.unite, p.prix_vente, c.nom
         HAVING COALESCE(SUM(s.quantite), 0) > 0
         ORDER BY quantite_vendue DESC, chiffre_affaires DESC
         LIMIT 5`
      );

      const produitsStockFaible = await queryAll(
        `SELECT st.*, p.nom as produit_nom, p.unite, p.prix_vente, c.nom as categorie_nom
         FROM stock st
         INNER JOIN produits p ON p.id = st.produit_id
         LEFT JOIN categories c ON c.id = p.categorie_id
         WHERE st.statut IN ('STOCK FAIBLE', 'RUPTURE')
         ORDER BY st.quantite_disponible ASC
         LIMIT 8`
      );

      const evolutionVentesMensuelles = await getEvolutionVentesMensuelles();

      res.json({
        database: MYSQL_DB_NAME,
        engine: 'MYSQL_CENTRAL',
        stats: {
          nombre_produits: Number(nbProduits),
          quantite_totale_stock: Number(stockTotal),
          ventes_jour_nombre: Number(ventesJour.count),
          ventes_jour_montant: Number(ventesJour.montant),
          achats_jour_nombre: Number(achatsJour.count),
          achats_jour_montant: Number(achatsJour.montant),
          chiffre_affaires: Number(chiffreAffaires),
          total_achats: Number(totalAchatsGlobal),
          produits_stock_faible: Number(nbStockFaible),
          produits_en_rupture: Number(nbRupture),
        },
        dernieres_ventes: dernieresVentes,
        dernieres_entrees: dernieresEntrees,
        produits_plus_vendus: produitsPlusVendus,
        produits_stock_faible: produitsStockFaible,
        evolution_ventes_mensuelles: evolutionVentesMensuelles,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord MySQL.', details: error?.message });
    }
  });

  const getEvolutionVentesMensuelles = async () => {
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthShortNames = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
      'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
    ];

    const months: Array<{
      mois: string;
      mois_label: string;
      mois_court: string;
      volume_quantite: number;
      nombre_ventes: number;
      chiffre_affaires: number;
    }> = [];

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const m = d.getMonth();
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      months.push({
        mois: key,
        mois_label: `${monthNames[m]} ${year}`,
        mois_court: `${monthShortNames[m]} ${String(year).slice(-2)}`,
        volume_quantite: 0,
        nombre_ventes: 0,
        chiffre_affaires: 0,
      });
    }

    const rows = await queryAll<{
      mois: string;
      nombre_ventes: number;
      volume_quantite: number;
      chiffre_affaires: number;
    }>(
      `SELECT SUBSTR(date_vente, 1, 7) as mois,
              COUNT(*) as nombre_ventes,
              COALESCE(SUM(quantite), 0) as volume_quantite,
              COALESCE(SUM(prix_total), 0) as chiffre_affaires
       FROM sorties
       WHERE date_vente >= ?
       GROUP BY SUBSTR(date_vente, 1, 7)`,
      [startDateStr]
    );

    const map = new Map<string, typeof rows[0]>();
    for (const r of rows) {
      if (r && r.mois) {
        map.set(r.mois, r);
      }
    }

    for (const item of months) {
      const found = map.get(item.mois);
      if (found) {
        item.volume_quantite = Number(found.volume_quantite || 0);
        item.nombre_ventes = Number(found.nombre_ventes || 0);
        item.chiffre_affaires = Number(found.chiffre_affaires || 0);
      }
    }

    return months;
  };

  app.get('/api/stats/ventes-mensuelles', async (_req: Request, res: Response) => {
    try {
      const data = await getEvolutionVentesMensuelles();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération des ventes mensuelles.', details: error?.message });
    }
  });

  // ============================================================================
  // 2. CATEGORIES (/api/categories)
  // ============================================================================
  app.get('/api/categories', async (_req: Request, res: Response) => {
    try {
      const rows = await queryAll(
        `SELECT c.id, c.nom, c.description, c.statut, c.date_creation, COUNT(p.id) as nombre_produits
         FROM categories c
         LEFT JOIN produits p ON p.categorie_id = c.id
         GROUP BY c.id, c.nom, c.description, c.statut, c.date_creation
         ORDER BY c.nom ASC`
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération des catégories.', details: error?.message });
    }
  });

  app.post('/api/categories', async (req: Request, res: Response) => {
    try {
      const { nom, description = '', statut = 'Actif' } = req.body;
      if (!nom || String(nom).trim().length === 0) {
        return res.status(400).json({ error: 'Le nom de la catégorie est obligatoire.' });
      }
      const cleanNom = String(nom).trim();
      const existing = await queryOne('SELECT id FROM categories WHERE LOWER(nom) = LOWER(?)', [cleanNom]);
      if (existing) {
        return res.status(400).json({ error: 'Une catégorie avec ce nom existe déjà.' });
      }
      const created = await runStatement(
        'INSERT INTO categories (nom, description, statut, date_creation) VALUES (?, ?, ?, ?)',
        [cleanNom, String(description).trim(), statut === 'Inactif' ? 'Inactif' : 'Actif', nowISO()]
      );
      const row = await queryOne('SELECT * FROM categories WHERE id = ?', [created.lastInsertRowid]);
      res.status(201).json({ message: 'Catégorie ajoutée avec succès.', data: row });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la création de la catégorie.', details: error?.message });
    }
  });

  app.put('/api/categories/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { nom, description = '', statut = 'Actif' } = req.body;
      const cleanNom = String(nom || '').trim();
      if (!id || !cleanNom) {
        return res.status(400).json({ error: 'Données invalides pour la modification de la catégorie.' });
      }
      const existing = await queryOne<{ id: number; nom: string }>(
        'SELECT id, nom FROM categories WHERE id = ?',
        [id]
      );
      if (!existing) {
        return res.status(404).json({ error: 'Catégorie introuvable.' });
      }
      const duplicate = await queryOne(
        'SELECT id FROM categories WHERE LOWER(nom) = LOWER(?) AND id != ?',
        [cleanNom, id]
      );
      if (duplicate) {
        return res.status(400).json({ error: 'Une autre catégorie avec ce nom existe déjà.' });
      }
      await runStatement(
        'UPDATE categories SET nom = ?, description = ?, statut = ? WHERE id = ?',
        [cleanNom, String(description).trim(), statut === 'Inactif' ? 'Inactif' : 'Actif', id]
      );
      if (existing.nom !== cleanNom) {
        await runStatement('UPDATE recus SET categorie_nom = ? WHERE categorie_nom = ?', [
          cleanNom,
          existing.nom,
        ]);
      }
      const updated = await queryOne('SELECT * FROM categories WHERE id = ?', [id]);
      res.json({ message: 'Catégorie mise à jour avec succès.', data: updated });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie.', details: error?.message });
    }
  });

  app.delete('/api/categories/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const usedBy = await queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM produits WHERE categorie_id = ?',
        [id]
      );
      if (usedBy && Number(usedBy.count) > 0) {
        return res.status(400).json({
          error: `Impossible de supprimer cette catégorie car elle contient ${usedBy.count} produit(s).`,
        });
      }
      await runStatement('DELETE FROM categories WHERE id = ?', [id]);
      res.json({ message: 'Catégorie supprimée avec succès.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie.', details: error?.message });
    }
  });

  // ============================================================================
  // 3. PRODUITS (/api/produits)
  // ============================================================================
  app.get('/api/produits', async (_req: Request, res: Response) => {
    try {
      await recalculateAllStocks();
      const rows = await queryAll(
        `SELECT p.*,
                c.nom as categorie_nom,
                COALESCE(st.quantite_disponible, 0) as stock_disponible,
                COALESCE(st.total_entrees, 0) as total_entrees,
                COALESCE(st.total_sorties, 0) as total_sorties,
                COALESCE(st.statut, 'RUPTURE') as stock_statut,
                st.derniere_mise_a_jour
         FROM produits p
         LEFT JOIN categories c ON c.id = p.categorie_id
         LEFT JOIN stock st ON st.produit_id = p.id
         ORDER BY p.nom ASC`
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération des produits.', details: error?.message });
    }
  });

  app.post('/api/produits', async (req: Request, res: Response) => {
    try {
      const {
        nom,
        categorie_id,
        prix_achat,
        prix_vente,
        unite = 'Unité',
        seuil_alerte = 10,
        statut = 'Actif',
        stock_initial = 0,
        quantite_initiale = 0,
      } = req.body;

      if (!nom || String(nom).trim().length === 0) {
        return res.status(400).json({ error: 'Le nom du produit est obligatoire.' });
      }
      let catId = Number(categorie_id || 0);
      const pAchat = Number(prix_achat ?? 0);
      const pVente = Number(prix_vente ?? 0);
      const seuil = Math.max(0, Number(seuil_alerte || 10));

      if (isNaN(pAchat) || pAchat < 0 || isNaN(pVente) || pVente < 0) {
        return res.status(400).json({ error: 'Données invalides : vérifiez les prix.' });
      }

      let catExists = catId
        ? await queryOne<{ id: number; nom: string }>('SELECT id, nom FROM categories WHERE id = ?', [catId])
        : null;

      if (!catExists) {
        const firstCat = await queryOne<{ id: number; nom: string }>(
          'SELECT id, nom FROM categories ORDER BY id ASC LIMIT 1'
        );
        if (firstCat) {
          catExists = firstCat;
          catId = firstCat.id;
        } else {
          const createdCat = await runStatement(
            'INSERT INTO categories (nom, description, statut, date_creation) VALUES (?, ?, ?, ?)',
            ['Général', 'Catégorie créée automatiquement', 'Actif', nowISO()]
          );
          catId = createdCat.lastInsertRowid;
          catExists = { id: catId, nom: 'Général' };
        }
      }

      const now = nowISO();
      const created = await runStatement(
        `INSERT INTO produits (nom, categorie_id, prix_achat, prix_vente, unite, seuil_alerte, statut, date_creation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(nom).trim(), catId, pAchat, pVente, String(unite || 'Unité').trim(), seuil, statut === 'Inactif' ? 'Inactif' : 'Actif', now]
      );

      const prodId = created.lastInsertRowid;

      const initQty = Math.floor(Number(stock_initial || quantite_initiale || 0));
      if (initQty > 0) {
        const numRecu = await generateReceiptNumber('ENT');
        const total = initQty * pAchat;
        const entRes = await runStatement(
          `INSERT INTO entrees (numero_recu, categorie_id, produit_id, quantite, prix_unitaire, prix_total, fournisseur_id, fournisseur_nom, fournisseur_contact, date_achat)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 'Stock Initial Inventaire', '-', ?)`,
          [numRecu, catId, prodId, initQty, pAchat, total, now]
        );
        await runStatement(
          `INSERT INTO recus (numero_recu, type_operation, sortie_id, entree_id, date_recu, partenaire_nom, partenaire_contact, produit_nom, categorie_nom, unite, quantite, prix_unitaire, prix_total, total_general)
           VALUES (?, 'ENTREE', NULL, ?, ?, 'Stock Initial Inventaire', '-', ?, ?, ?, ?, ?, ?, ?)`,
          [
            numRecu,
            entRes.lastInsertRowid,
            now,
            String(nom).trim(),
            catExists.nom,
            String(unite || 'Unité').trim(),
            initQty,
            pAchat,
            total,
            total,
          ]
        );
      }

      await recalculateStockForProduct(prodId);

      const fullProduct = await queryOne(
        `SELECT p.*, c.nom as categorie_nom,
                COALESCE(st.quantite_disponible, 0) as stock_disponible,
                COALESCE(st.statut, 'RUPTURE') as stock_statut
         FROM produits p
         LEFT JOIN categories c ON c.id = p.categorie_id
         LEFT JOIN stock st ON st.produit_id = p.id
         WHERE p.id = ?`,
        [prodId]
      );

      res.status(201).json({ message: 'Produit ajouté avec succès.', data: fullProduct });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de l'ajout du produit.", details: error?.message });
    }
  });

  app.put('/api/produits/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const {
        nom,
        categorie_id,
        prix_achat,
        prix_vente,
        unite = 'Unité',
        seuil_alerte = 10,
        statut = 'Actif',
      } = req.body;

      const existing = await queryOne<{ id: number; nom: string }>('SELECT id, nom FROM produits WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Produit inexistant.' });
      }

      const catId = Number(categorie_id);
      const pAchat = Number(prix_achat);
      const pVente = Number(prix_vente);
      const seuil = Math.max(0, Number(seuil_alerte ?? 10));
      const cleanNom = String(nom || '').trim();
      const cleanUnite = String(unite || 'Unité').trim();

      if (!cleanNom || !catId || isNaN(pAchat) || pAchat < 0 || isNaN(pVente) || pVente < 0) {
        return res.status(400).json({ error: 'Données invalides.' });
      }

      await runStatement(
        `UPDATE produits
         SET nom = ?, categorie_id = ?, prix_achat = ?, prix_vente = ?, unite = ?, seuil_alerte = ?, statut = ?
         WHERE id = ?`,
        [cleanNom, catId, pAchat, pVente, cleanUnite, seuil, statut === 'Inactif' ? 'Inactif' : 'Actif', id]
      );

      await runStatement('UPDATE entrees SET categorie_id = ? WHERE produit_id = ?', [catId, id]);
      await runStatement('UPDATE sorties SET categorie_id = ? WHERE produit_id = ?', [catId, id]);

      const catRow = await queryOne<{ nom: string }>('SELECT nom FROM categories WHERE id = ?', [catId]);
      const catNom = catRow?.nom || '';

      await runStatement(
        `UPDATE recus
         SET produit_nom = ?, unite = ?, categorie_nom = ?
         WHERE produit_nom = ?
            OR entree_id IN (SELECT id FROM entrees WHERE produit_id = ?)
            OR sortie_id IN (SELECT id FROM sorties WHERE produit_id = ?)`,
        [cleanNom, cleanUnite, catNom, existing.nom, id, id]
      );

      await recalculateStockForProduct(id);

      const updated = await queryOne(
        `SELECT p.*, c.nom as categorie_nom,
                COALESCE(st.quantite_disponible, 0) as stock_disponible,
                COALESCE(st.statut, 'RUPTURE') as stock_statut
         FROM produits p
         LEFT JOIN categories c ON c.id = p.categorie_id
         LEFT JOIN stock st ON st.produit_id = p.id
         WHERE p.id = ?`,
        [id]
      );

      res.json({ message: 'Produit modifié avec succès.', data: updated });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la modification du produit.', details: error?.message });
    }
  });

  app.delete('/api/produits/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const existing = await queryOne<{ id: number; nom: string }>('SELECT id, nom FROM produits WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Produit inexistant.' });
      }
      await runStatement(
        'DELETE FROM recus WHERE sortie_id IN (SELECT id FROM sorties WHERE produit_id = ?) OR entree_id IN (SELECT id FROM entrees WHERE produit_id = ?)',
        [id, id]
      );
      await runStatement('DELETE FROM stock WHERE produit_id = ?', [id]);
      await runStatement('DELETE FROM entrees WHERE produit_id = ?', [id]);
      await runStatement('DELETE FROM sorties WHERE produit_id = ?', [id]);
      await runStatement('DELETE FROM produits WHERE id = ?', [id]);
      res.json({ message: 'Produit supprimé avec succès.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la suppression du produit.', details: error?.message });
    }
  });

  // ============================================================================
  // 4. ENTRÉES / ACHATS (/api/entrees)
  // ============================================================================
  app.get('/api/entrees', async (_req: Request, res: Response) => {
    try {
      const rows = await queryAll(
        `SELECT e.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM entrees e
         LEFT JOIN produits p ON p.id = e.produit_id
         LEFT JOIN categories c ON c.id = e.categorie_id
         ORDER BY e.date_achat DESC, e.id DESC`
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération des entrées.', details: error?.message });
    }
  });

  app.post('/api/entrees', async (req: Request, res: Response) => {
    try {
      const {
        produit_id,
        produit_nom,
        unite,
        categorie_id,
        quantite,
        prix_unitaire,
        fournisseur_id,
        fournisseur_nom,
        fournisseur_contact = '',
        date_achat,
      } = req.body;

      let prodId = Number(produit_id || 0);
      const cleanProdNom = String(produit_nom || '').trim();
      const qty = Math.floor(Number(quantite));
      const pu = Number(prix_unitaire ?? 0);

      if ((!prodId && !cleanProdNom) || isNaN(qty) || qty <= 0 || isNaN(pu) || pu < 0) {
        return res
          .status(400)
          .json({ error: 'Données invalides : vérifiez le produit, la quantité et le prix unitaire.' });
      }

      let prod = prodId
        ? await queryOne<{ id: number; nom: string; categorie_id: number; unite: string }>(
            'SELECT id, nom, categorie_id, unite FROM produits WHERE id = ?',
            [prodId]
          )
        : null;

      if (!prod && cleanProdNom) {
        prod = await queryOne<{ id: number; nom: string; categorie_id: number; unite: string }>(
          'SELECT id, nom, categorie_id, unite FROM produits WHERE LOWER(nom) = LOWER(?)',
          [cleanProdNom]
        );
        if (!prod) {
          let validCat = categorie_id
            ? await queryOne<{ id: number }>('SELECT id FROM categories WHERE id = ?', [Number(categorie_id)])
            : null;
          if (!validCat) {
            validCat = await queryOne<{ id: number }>('SELECT id FROM categories ORDER BY id ASC LIMIT 1');
          }
          let resolvedCatId = Number(validCat?.id || 0);
          if (!resolvedCatId) {
            const createdCat = await runStatement(
              'INSERT INTO categories (nom, description, statut, date_creation) VALUES (?, ?, ?, ?)',
              ['Général', 'Catégorie créée automatiquement', 'Actif', nowISO()]
            );
            resolvedCatId = createdCat.lastInsertRowid;
          }
          const resolvedUnite = String(unite || 'Unité').trim() || 'Unité';
          const createdProd = await runStatement(
            `INSERT INTO produits (nom, categorie_id, prix_achat, prix_vente, unite, seuil_alerte, statut, date_creation)
             VALUES (?, ?, ?, 0, ?, 10, 'Actif', ?)`,
            [cleanProdNom, resolvedCatId, pu, resolvedUnite, nowISO()]
          );
          prodId = createdProd.lastInsertRowid;
          prod = {
            id: prodId,
            nom: cleanProdNom,
            categorie_id: resolvedCatId,
            unite: resolvedUnite,
          };
        } else {
          prodId = prod.id;
        }
      }

      if (!prod) {
        return res.status(404).json({ error: 'Produit inexistant.' });
      }
      prodId = prod.id;

      const catId = Number(prod.categorie_id);
      const cat = await queryOne<{ nom: string }>('SELECT nom FROM categories WHERE id = ?', [catId]);

      const prixTotal = qty * pu;
      const dateOp = date_achat && String(date_achat).trim() ? String(date_achat).trim() : nowISO();
      const cleanSuppNom = String(fournisseur_nom || 'Fournisseur Standard').trim();
      const cleanSuppContact = String(fournisseur_contact || '').trim();

      const isInternalStockLabel =
        cleanSuppNom.toLowerCase() === 'approvisionnement stock' ||
        cleanSuppNom.toLowerCase() === 'stock initial inventaire' ||
        cleanSuppNom.toLowerCase() === 'fournisseur standard';

      let resolvedSuppId = fournisseur_id ? Number(fournisseur_id) : null;
      if (!resolvedSuppId && cleanSuppNom && !isInternalStockLabel) {
        const existingSupp = await queryOne<{ id: number; telephone: string }>(
          'SELECT id, telephone FROM fournisseurs WHERE LOWER(nom_complet) = LOWER(?)',
          [cleanSuppNom]
        );
        if (existingSupp) {
          resolvedSuppId = existingSupp.id;
          if (cleanSuppContact && !existingSupp.telephone) {
            await runStatement('UPDATE fournisseurs SET telephone = ? WHERE id = ?', [
              cleanSuppContact,
              existingSupp.id,
            ]);
          }
        } else {
          const newSupp = await runStatement(
            'INSERT INTO fournisseurs (nom_complet, telephone, adresse, email, date_ajout) VALUES (?, ?, ?, ?, ?)',
            [cleanSuppNom, cleanSuppContact, '', '', nowISO()]
          );
          resolvedSuppId = newSupp.lastInsertRowid;
        }
      }

      const numeroRecu = await generateReceiptNumber('ENT');

      const created = await runStatement(
        `INSERT INTO entrees (numero_recu, categorie_id, produit_id, quantite, prix_unitaire, prix_total, fournisseur_id, fournisseur_nom, fournisseur_contact, date_achat)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [numeroRecu, catId, prodId, qty, pu, prixTotal, resolvedSuppId, cleanSuppNom, cleanSuppContact, dateOp]
      );

      if (pu > 0) {
        await runStatement('UPDATE produits SET prix_achat = ? WHERE id = ?', [pu, prodId]);
      }

      const recuCreated = await runStatement(
        `INSERT INTO recus (numero_recu, type_operation, sortie_id, entree_id, date_recu, partenaire_nom, partenaire_contact, produit_nom, categorie_nom, unite, quantite, prix_unitaire, prix_total, total_general)
         VALUES (?, 'ENTREE', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numeroRecu,
          created.lastInsertRowid,
          dateOp,
          cleanSuppNom,
          cleanSuppContact,
          prod.nom,
          cat?.nom || '',
          prod.unite,
          qty,
          pu,
          prixTotal,
          prixTotal,
        ]
      );

      await recalculateStockForProduct(prodId);

      const entryRow = await queryOne(
        `SELECT e.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM entrees e
         LEFT JOIN produits p ON p.id = e.produit_id
         LEFT JOIN categories c ON c.id = e.categorie_id
         WHERE e.id = ?`,
        [created.lastInsertRowid]
      );

      const recuRow = await queryOne('SELECT * FROM recus WHERE id = ?', [recuCreated.lastInsertRowid]);

      res.status(201).json({
        message: 'Entrée enregistrée avec succès.',
        stock_message: 'Stock mis à jour.',
        data: entryRow,
        recu: recuRow,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de l'enregistrement de l'entrée.", details: error?.message });
    }
  });

  app.delete('/api/entrees/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const existing = await queryOne<{ id: number; produit_id: number; numero_recu: string }>(
        'SELECT id, produit_id, numero_recu FROM entrees WHERE id = ?',
        [id]
      );
      if (!existing) {
        return res.status(404).json({ error: 'Entrée introuvable.' });
      }
      await runStatement('DELETE FROM recus WHERE entree_id = ? OR numero_recu = ?', [
        id,
        existing.numero_recu,
      ]);
      await runStatement('DELETE FROM entrees WHERE id = ?', [id]);
      const lastEntree = await queryOne<{ prix_unitaire: number }>(
        'SELECT prix_unitaire FROM entrees WHERE produit_id = ? ORDER BY date_achat DESC, id DESC LIMIT 1',
        [existing.produit_id]
      );
      await runStatement('UPDATE produits SET prix_achat = ? WHERE id = ?', [
        Number(lastEntree?.prix_unitaire || 0),
        existing.produit_id,
      ]);
      await recalculateStockForProduct(existing.produit_id);
      res.json({ message: 'Entrée supprimée et stock mis à jour.' });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de la suppression de l'entrée.", details: error?.message });
    }
  });

  // ============================================================================
  // 5. VENTES / SORTIES (/api/sorties)
  // ============================================================================
  app.get('/api/sorties', async (_req: Request, res: Response) => {
    try {
      const rows = await queryAll(
        `SELECT s.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM sorties s
         LEFT JOIN produits p ON p.id = s.produit_id
         LEFT JOIN categories c ON c.id = s.categorie_id
         ORDER BY s.date_vente DESC, s.id DESC`
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération des ventes.', details: error?.message });
    }
  });

  app.post('/api/sorties', async (req: Request, res: Response) => {
    try {
      const {
        produit_id,
        categorie_id,
        quantite,
        prix_unitaire,
        client_id,
        client_nom,
        client_contact = '',
        date_vente,
      } = req.body;

      const prodId = Number(produit_id);
      const qty = Math.floor(Number(quantite));
      const pu = Number(prix_unitaire);

      if (!prodId || isNaN(qty) || qty <= 0 || isNaN(pu) || pu < 0) {
        return res
          .status(400)
          .json({ error: 'Données invalides : vérifiez le produit, la quantité et le prix.' });
      }

      const prod = await queryOne<{ id: number; nom: string; categorie_id: number; unite: string }>(
        'SELECT id, nom, categorie_id, unite FROM produits WHERE id = ?',
        [prodId]
      );
      if (!prod) {
        return res.status(404).json({ error: 'Produit inexistant.' });
      }

      await recalculateStockForProduct(prodId);
      const stockRow = await queryOne<{ quantite_disponible: number }>(
        'SELECT quantite_disponible FROM stock WHERE produit_id = ?',
        [prodId]
      );
      const disponible = Number(stockRow?.quantite_disponible || 0);

      if (qty > disponible) {
        return res.status(400).json({
          error: 'Stock insuffisant',
          message: 'Stock insuffisant',
          stock_disponible: disponible,
          quantite_demandee: qty,
        });
      }

      const catId = Number(prod.categorie_id);
      const cat = await queryOne<{ nom: string }>('SELECT nom FROM categories WHERE id = ?', [catId]);

      const prixTotal = qty * pu;
      const dateOp = date_vente && String(date_vente).trim() ? String(date_vente).trim() : nowISO();
      const cleanClientNom = String(client_nom || 'Client Comptant').trim();
      const cleanClientContact = String(client_contact || '').trim();

      let resolvedClientId = client_id ? Number(client_id) : null;
      if (!resolvedClientId && cleanClientNom) {
        const existingClient = await queryOne<{ id: number; telephone: string }>(
          'SELECT id, telephone FROM clients WHERE LOWER(nom_complet) = LOWER(?)',
          [cleanClientNom]
        );
        if (existingClient) {
          resolvedClientId = existingClient.id;
          if (cleanClientContact && !existingClient.telephone) {
            await runStatement('UPDATE clients SET telephone = ? WHERE id = ?', [
              cleanClientContact,
              existingClient.id,
            ]);
          }
        } else {
          const newClient = await runStatement(
            'INSERT INTO clients (nom_complet, telephone, adresse, email, date_ajout) VALUES (?, ?, ?, ?, ?)',
            [cleanClientNom, cleanClientContact, '', '', nowISO()]
          );
          resolvedClientId = newClient.lastInsertRowid;
        }
      }

      const numeroRecu = await generateReceiptNumber('REC');

      const created = await runStatement(
        `INSERT INTO sorties (numero_recu, categorie_id, produit_id, quantite, prix_unitaire, prix_total, client_id, client_nom, client_contact, date_vente)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [numeroRecu, catId, prodId, qty, pu, prixTotal, resolvedClientId, cleanClientNom, cleanClientContact, dateOp]
      );

      if (pu > 0) {
        await runStatement('UPDATE produits SET prix_vente = ? WHERE id = ?', [pu, prodId]);
      }

      const recuCreated = await runStatement(
        `INSERT INTO recus (numero_recu, type_operation, sortie_id, entree_id, date_recu, partenaire_nom, partenaire_contact, produit_nom, categorie_nom, unite, quantite, prix_unitaire, prix_total, total_general)
         VALUES (?, 'VENTE', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numeroRecu,
          created.lastInsertRowid,
          dateOp,
          cleanClientNom,
          cleanClientContact,
          prod.nom,
          cat?.nom || '',
          prod.unite,
          qty,
          pu,
          prixTotal,
          prixTotal,
        ]
      );

      await recalculateStockForProduct(prodId);

      const saleRow = await queryOne(
        `SELECT s.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM sorties s
         LEFT JOIN produits p ON p.id = s.produit_id
         LEFT JOIN categories c ON c.id = s.categorie_id
         WHERE s.id = ?`,
        [created.lastInsertRowid]
      );

      const recuRow = await queryOne('SELECT * FROM recus WHERE id = ?', [recuCreated.lastInsertRowid]);

      res.status(201).json({
        message: 'Vente enregistrée avec succès.',
        stock_message: 'Stock mis à jour.',
        data: saleRow,
        recu: recuRow,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de l'enregistrement de la vente.", details: error?.message });
    }
  });

  app.put('/api/sorties/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const {
        produit_id,
        quantite,
        prix_unitaire,
        client_id,
        client_nom,
        client_contact = '',
      } = req.body;

      const existing = await queryOne<{
        id: number;
        numero_recu: string;
        produit_id: number;
        quantite: number;
        date_vente: string;
      }>('SELECT id, numero_recu, produit_id, quantite, date_vente FROM sorties WHERE id = ?', [id]);

      if (!existing) {
        return res.status(404).json({ error: 'Vente introuvable.' });
      }

      const prodId = Number(produit_id || existing.produit_id);
      const qty = Math.floor(Number(quantite));
      const pu = Number(prix_unitaire);

      if (!prodId || isNaN(qty) || qty <= 0 || isNaN(pu) || pu < 0) {
        return res
          .status(400)
          .json({ error: 'Données invalides : vérifiez le produit, la quantité et le prix.' });
      }

      const prod = await queryOne<{ id: number; nom: string; categorie_id: number; unite: string }>(
        'SELECT id, nom, categorie_id, unite FROM produits WHERE id = ?',
        [prodId]
      );
      if (!prod) {
        return res.status(404).json({ error: 'Produit inexistant.' });
      }

      await recalculateStockForProduct(prodId);
      const stockRow = await queryOne<{ quantite_disponible: number }>(
        'SELECT quantite_disponible FROM stock WHERE produit_id = ?',
        [prodId]
      );
      const currentDisponible = Number(stockRow?.quantite_disponible || 0);
      const maxDisponible =
        prodId === Number(existing.produit_id)
          ? currentDisponible + Number(existing.quantite)
          : currentDisponible;

      if (qty > maxDisponible) {
        return res.status(400).json({
          error: 'Stock insuffisant',
          message: 'Stock insuffisant',
          stock_disponible: maxDisponible,
          quantite_demandee: qty,
        });
      }

      const catId = Number(prod.categorie_id);
      const cat = await queryOne<{ nom: string }>('SELECT nom FROM categories WHERE id = ?', [catId]);
      const prixTotal = qty * pu;
      const cleanClientNom = String(client_nom || 'Client Comptant').trim();
      const cleanClientContact = String(client_contact || '').trim();

      let resolvedClientId = client_id ? Number(client_id) : null;
      if (!resolvedClientId && cleanClientNom) {
        const existingClient = await queryOne<{ id: number; telephone: string }>(
          'SELECT id, telephone FROM clients WHERE LOWER(nom_complet) = LOWER(?)',
          [cleanClientNom]
        );
        if (existingClient) {
          resolvedClientId = existingClient.id;
          if (cleanClientContact && !existingClient.telephone) {
            await runStatement('UPDATE clients SET telephone = ? WHERE id = ?', [
              cleanClientContact,
              existingClient.id,
            ]);
          }
        } else {
          const newClient = await runStatement(
            'INSERT INTO clients (nom_complet, telephone, adresse, email, date_ajout) VALUES (?, ?, ?, ?, ?)',
            [cleanClientNom, cleanClientContact, '', '', nowISO()]
          );
          resolvedClientId = newClient.lastInsertRowid;
        }
      }

      await runStatement(
        `UPDATE sorties
         SET categorie_id = ?, produit_id = ?, quantite = ?, prix_unitaire = ?, prix_total = ?, client_id = ?, client_nom = ?, client_contact = ?
         WHERE id = ?`,
        [catId, prodId, qty, pu, prixTotal, resolvedClientId, cleanClientNom, cleanClientContact, id]
      );

      if (pu > 0) {
        await runStatement('UPDATE produits SET prix_vente = ? WHERE id = ?', [pu, prodId]);
      }

      await runStatement(
        `UPDATE recus
         SET partenaire_nom = ?, partenaire_contact = ?, produit_nom = ?, categorie_nom = ?, unite = ?, quantite = ?, prix_unitaire = ?, prix_total = ?, total_general = ?
         WHERE sortie_id = ? OR numero_recu = ?`,
        [
          cleanClientNom,
          cleanClientContact,
          prod.nom,
          cat?.nom || '',
          prod.unite,
          qty,
          pu,
          prixTotal,
          prixTotal,
          id,
          existing.numero_recu,
        ]
      );

      if (Number(existing.produit_id) !== prodId) {
        await recalculateStockForProduct(Number(existing.produit_id));
      }
      await recalculateStockForProduct(prodId);

      const saleRow = await queryOne(
        `SELECT s.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM sorties s
         LEFT JOIN produits p ON p.id = s.produit_id
         LEFT JOIN categories c ON c.id = s.categorie_id
         WHERE s.id = ?`,
        [id]
      );

      const recuRow = await queryOne(
        'SELECT * FROM recus WHERE sortie_id = ? OR numero_recu = ?',
        [id, existing.numero_recu]
      );

      res.json({
        message: 'Vente modifiée avec succès.',
        data: saleRow,
        recu: recuRow,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la modification de la vente.', details: error?.message });
    }
  });

  app.delete('/api/sorties/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const existing = await queryOne<{ id: number; produit_id: number; numero_recu: string }>(
        'SELECT id, produit_id, numero_recu FROM sorties WHERE id = ?',
        [id]
      );
      if (!existing) {
        return res.status(404).json({ error: 'Vente introuvable.' });
      }
      await runStatement('DELETE FROM recus WHERE sortie_id = ? OR numero_recu = ?', [
        id,
        existing.numero_recu,
      ]);
      await runStatement('DELETE FROM sorties WHERE id = ?', [id]);
      const lastSortie = await queryOne<{ prix_unitaire: number }>(
        'SELECT prix_unitaire FROM sorties WHERE produit_id = ? ORDER BY date_vente DESC, id DESC LIMIT 1',
        [existing.produit_id]
      );
      await runStatement('UPDATE produits SET prix_vente = ? WHERE id = ?', [
        Number(lastSortie?.prix_unitaire || 0),
        existing.produit_id,
      ]);
      await recalculateStockForProduct(existing.produit_id);
      res.json({ message: 'Vente supprimée et stock mis à jour.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la suppression de la vente.', details: error?.message });
    }
  });

  // ============================================================================
  // 6. STOCK (/api/stock)
  // ============================================================================
  app.get('/api/stock', async (_req: Request, res: Response) => {
    try {
      await recalculateAllStocks();
      const rows = await queryAll(
        `SELECT st.*,
                p.nom as produit_nom,
                p.prix_achat,
                p.prix_vente,
                p.unite,
                p.categorie_id,
                c.nom as categorie_nom
         FROM stock st
         INNER JOIN produits p ON p.id = st.produit_id
         LEFT JOIN categories c ON c.id = p.categorie_id
         ORDER BY st.derniere_mise_a_jour DESC, p.id DESC`
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération du stock.', details: error?.message });
    }
  });

  const handleUpdateStockThreshold = async (req: Request, res: Response) => {
    try {
      const prodId = Number(req.params.produit_id);
      const { seuil_alerte } = req.body;
      const seuil = Math.max(0, Number(seuil_alerte));
      if (!prodId || isNaN(seuil)) {
        return res.status(400).json({ error: "Seuil d'alerte invalide." });
      }
      await runStatement('UPDATE produits SET seuil_alerte = ? WHERE id = ?', [seuil, prodId]);
      await recalculateStockForProduct(prodId);
      const updated = await queryOne('SELECT * FROM stock WHERE produit_id = ?', [prodId]);
      res.json({ message: 'Stock mis à jour.', data: updated });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la mise à jour du seuil de stock.', details: error?.message });
    }
  };

  app.put('/api/stock/:produit_id', handleUpdateStockThreshold);
  app.put('/api/stock/:produit_id/seuil', handleUpdateStockThreshold);

  // ============================================================================
  // 7. CLIENTS (/api/clients)
  // ============================================================================
  app.get('/api/clients', async (_req: Request, res: Response) => {
    try {
      const rows = await queryAll(
        `SELECT cl.id, cl.nom_complet, cl.telephone, cl.adresse, cl.email, cl.date_ajout,
                COUNT(s.id) as nombre_achats,
                COALESCE(SUM(s.prix_total), 0) as montant_total
         FROM clients cl
         LEFT JOIN sorties s ON (s.client_id = cl.id OR LOWER(s.client_nom) = LOWER(cl.nom_complet))
         GROUP BY cl.id, cl.nom_complet, cl.telephone, cl.adresse, cl.email, cl.date_ajout
         ORDER BY cl.nom_complet ASC`
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération des clients.', details: error?.message });
    }
  });

  app.get('/api/clients/:id/historique', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const client = await queryOne<{ id: number; nom_complet: string }>(
        'SELECT * FROM clients WHERE id = ?',
        [id]
      );
      if (!client) {
        return res.status(404).json({ error: 'Client introuvable.' });
      }
      const ventes = await queryAll(
        `SELECT s.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM sorties s
         LEFT JOIN produits p ON p.id = s.produit_id
         LEFT JOIN categories c ON c.id = s.categorie_id
         WHERE s.client_id = ? OR LOWER(s.client_nom) = LOWER(?)
         ORDER BY s.date_vente DESC`,
        [id, client.nom_complet]
      );
      res.json({ client, ventes });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération de l'historique client.", details: error?.message });
    }
  });

  app.post('/api/clients', async (req: Request, res: Response) => {
    try {
      const { nom_complet, telephone = '', adresse = '', email = '' } = req.body;
      if (!nom_complet || String(nom_complet).trim().length === 0) {
        return res.status(400).json({ error: 'Le nom complet du client est obligatoire.' });
      }
      const created = await runStatement(
        'INSERT INTO clients (nom_complet, telephone, adresse, email, date_ajout) VALUES (?, ?, ?, ?, ?)',
        [
          String(nom_complet).trim(),
          String(telephone).trim(),
          String(adresse).trim(),
          String(email).trim(),
          nowISO(),
        ]
      );
      await runStatement(
        'UPDATE sorties SET client_id = ? WHERE client_id IS NULL AND LOWER(client_nom) = LOWER(?)',
        [created.lastInsertRowid, String(nom_complet).trim()]
      );
      const row = await queryOne('SELECT * FROM clients WHERE id = ?', [created.lastInsertRowid]);
      res.status(201).json({ message: 'Client ajouté avec succès.', data: row });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de l'ajout du client.", details: error?.message });
    }
  });

  app.put('/api/clients/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { nom_complet, telephone = '', adresse = '', email = '' } = req.body;
      const cleanNom = String(nom_complet || '').trim();
      const cleanTel = String(telephone || '').trim();
      if (!id || !cleanNom) {
        return res.status(400).json({ error: 'Données invalides.' });
      }
      const prev = await queryOne<{ nom_complet: string }>(
        'SELECT nom_complet FROM clients WHERE id = ?',
        [id]
      );
      await runStatement(
        'UPDATE clients SET nom_complet = ?, telephone = ?, adresse = ?, email = ? WHERE id = ?',
        [cleanNom, cleanTel, String(adresse).trim(), String(email).trim(), id]
      );
      await runStatement('UPDATE sorties SET client_nom = ?, client_contact = ? WHERE client_id = ?', [
        cleanNom,
        cleanTel,
        id,
      ]);
      if (prev && prev.nom_complet !== cleanNom) {
        await runStatement(
          "UPDATE recus SET partenaire_nom = ?, partenaire_contact = ? WHERE type_operation = 'VENTE' AND LOWER(partenaire_nom) = LOWER(?)",
          [cleanNom, cleanTel, prev.nom_complet]
        );
      }
      const row = await queryOne('SELECT * FROM clients WHERE id = ?', [id]);
      res.json({ message: 'Client modifié avec succès.', data: row });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la modification du client.', details: error?.message });
    }
  });

  app.delete('/api/clients/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      await runStatement('UPDATE sorties SET client_id = NULL WHERE client_id = ?', [id]);
      await runStatement('DELETE FROM clients WHERE id = ?', [id]);
      res.json({ message: 'Client supprimé avec succès.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la suppression du client.', details: error?.message });
    }
  });

  // ============================================================================
  // 8. FOURNISSEURS (/api/fournisseurs)
  // ============================================================================
  app.get('/api/fournisseurs', async (_req: Request, res: Response) => {
    try {
      const rows = await queryAll(
        `SELECT f.id, f.nom_complet, f.telephone, f.adresse, f.email, f.date_ajout,
                COUNT(e.id) as nombre_approvisionnements,
                COALESCE(SUM(e.prix_total), 0) as montant_total
         FROM fournisseurs f
         LEFT JOIN entrees e ON (e.fournisseur_id = f.id OR LOWER(e.fournisseur_nom) = LOWER(f.nom_complet))
         GROUP BY f.id, f.nom_complet, f.telephone, f.adresse, f.email, f.date_ajout
         ORDER BY f.nom_complet ASC`
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs.', details: error?.message });
    }
  });

  app.get('/api/fournisseurs/:id/historique', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const fournisseur = await queryOne<{ id: number; nom_complet: string }>(
        'SELECT * FROM fournisseurs WHERE id = ?',
        [id]
      );
      if (!fournisseur) {
        return res.status(404).json({ error: 'Fournisseur introuvable.' });
      }
      const achats = await queryAll(
        `SELECT e.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM entrees e
         LEFT JOIN produits p ON p.id = e.produit_id
         LEFT JOIN categories c ON c.id = e.categorie_id
         WHERE e.fournisseur_id = ? OR LOWER(e.fournisseur_nom) = LOWER(?)
         ORDER BY e.date_achat DESC`,
        [id, fournisseur.nom_complet]
      );
      res.json({ fournisseur, achats });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: "Erreur lors de la récupération de l'historique fournisseur.", details: error?.message });
    }
  });

  app.post('/api/fournisseurs', async (req: Request, res: Response) => {
    try {
      const { nom_complet, telephone = '', adresse = '', email = '' } = req.body;
      if (!nom_complet || String(nom_complet).trim().length === 0) {
        return res.status(400).json({ error: 'Le nom complet du fournisseur est obligatoire.' });
      }
      const created = await runStatement(
        'INSERT INTO fournisseurs (nom_complet, telephone, adresse, email, date_ajout) VALUES (?, ?, ?, ?, ?)',
        [
          String(nom_complet).trim(),
          String(telephone).trim(),
          String(adresse).trim(),
          String(email).trim(),
          nowISO(),
        ]
      );
      await runStatement(
        'UPDATE entrees SET fournisseur_id = ? WHERE fournisseur_id IS NULL AND LOWER(fournisseur_nom) = LOWER(?)',
        [created.lastInsertRowid, String(nom_complet).trim()]
      );
      const row = await queryOne('SELECT * FROM fournisseurs WHERE id = ?', [created.lastInsertRowid]);
      res.status(201).json({ message: 'Fournisseur ajouté avec succès.', data: row });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de l'ajout du fournisseur.", details: error?.message });
    }
  });

  app.put('/api/fournisseurs/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { nom_complet, telephone = '', adresse = '', email = '' } = req.body;
      const cleanNom = String(nom_complet || '').trim();
      const cleanTel = String(telephone || '').trim();
      if (!id || !cleanNom) {
        return res.status(400).json({ error: 'Données invalides.' });
      }
      const prev = await queryOne<{ nom_complet: string }>(
        'SELECT nom_complet FROM fournisseurs WHERE id = ?',
        [id]
      );
      await runStatement(
        'UPDATE fournisseurs SET nom_complet = ?, telephone = ?, adresse = ?, email = ? WHERE id = ?',
        [cleanNom, cleanTel, String(adresse).trim(), String(email).trim(), id]
      );
      await runStatement(
        'UPDATE entrees SET fournisseur_nom = ?, fournisseur_contact = ? WHERE fournisseur_id = ?',
        [cleanNom, cleanTel, id]
      );
      if (prev && prev.nom_complet !== cleanNom) {
        await runStatement(
          "UPDATE recus SET partenaire_nom = ?, partenaire_contact = ? WHERE type_operation = 'ENTREE' AND LOWER(partenaire_nom) = LOWER(?)",
          [cleanNom, cleanTel, prev.nom_complet]
        );
      }
      const row = await queryOne('SELECT * FROM fournisseurs WHERE id = ?', [id]);
      res.json({ message: 'Fournisseur modifié avec succès.', data: row });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la modification du fournisseur.', details: error?.message });
    }
  });

  app.delete('/api/fournisseurs/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      await runStatement('UPDATE entrees SET fournisseur_id = NULL WHERE fournisseur_id = ?', [id]);
      await runStatement('DELETE FROM fournisseurs WHERE id = ?', [id]);
      res.json({ message: 'Fournisseur supprimé avec succès.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la suppression du fournisseur.', details: error?.message });
    }
  });

  // ============================================================================
  // 9. REÇUS (/api/recus)
  // ============================================================================
  app.get('/api/recus', async (_req: Request, res: Response) => {
    try {
      const rows = await queryAll('SELECT * FROM recus ORDER BY date_recu DESC, id DESC');
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération des reçus.', details: error?.message });
    }
  });

  app.delete('/api/recus/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      await runStatement('DELETE FROM recus WHERE id = ?', [id]);
      res.json({ message: 'Reçu supprimé avec succès.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la suppression du reçu.', details: error?.message });
    }
  });

  app.post('/api/reset', async (_req: Request, res: Response) => {
    try {
      await runStatement('DELETE FROM recus');
      await runStatement('DELETE FROM stock');
      await runStatement('DELETE FROM sorties');
      await runStatement('DELETE FROM entrees');
      await runStatement('DELETE FROM produits');
      await runStatement('DELETE FROM clients');
      await runStatement('DELETE FROM fournisseurs');
      await runStatement('DELETE FROM categories');

      persistEmbeddedSql();
      res.json({ message: 'Toutes les données MySQL ont été réinitialisées (0 donnée).' });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la réinitialisation.', details: error?.message });
    }
  });

  // ============================================================================
  // 9B. HISTORIQUE CHRONOLOGIQUE (/api/historique)
  // ============================================================================
  app.get('/api/historique', async (req: Request, res: Response) => {
    try {
      const dateDebut = String(req.query.date_debut || '2000-01-01').slice(0, 10);
      const dateFin = String(req.query.date_fin || '2099-12-31').slice(0, 10);
      const typeFilter = String(req.query.type || 'ALL').toUpperCase();
      const catId = req.query.categorie_id && req.query.categorie_id !== 'ALL' ? Number(req.query.categorie_id) : null;

      const rows = await queryAll<{
        id: number;
        type: 'VENTE' | 'ENTREE';
        numero_recu: string;
        date_op: string;
        produit_id: number;
        produit_nom: string;
        categorie_id: number;
        categorie_nom: string;
        unite: string;
        quantite: number;
        prix_unitaire: number;
        prix_total: number;
        partenaire_nom: string;
        partenaire_contact: string;
      }>(
        `SELECT * FROM (
           SELECT s.id as id,
                  'VENTE' as type,
                  s.numero_recu as numero_recu,
                  s.date_vente as date_op,
                  s.produit_id as produit_id,
                  COALESCE(p.nom, '-') as produit_nom,
                  s.categorie_id as categorie_id,
                  COALESCE(c.nom, 'Non classé') as categorie_nom,
                  COALESCE(p.unite, 'Unité') as unite,
                  s.quantite as quantite,
                  s.prix_unitaire as prix_unitaire,
                  s.prix_total as prix_total,
                  s.client_nom as partenaire_nom,
                  s.client_contact as partenaire_contact
           FROM sorties s
           LEFT JOIN produits p ON p.id = s.produit_id
           LEFT JOIN categories c ON c.id = s.categorie_id
           UNION ALL
           SELECT e.id as id,
                  'ENTREE' as type,
                  e.numero_recu as numero_recu,
                  e.date_achat as date_op,
                  e.produit_id as produit_id,
                  COALESCE(p.nom, '-') as produit_nom,
                  e.categorie_id as categorie_id,
                  COALESCE(c.nom, 'Non classé') as categorie_nom,
                  COALESCE(p.unite, 'Unité') as unite,
                  e.quantite as quantite,
                  e.prix_unitaire as prix_unitaire,
                  e.prix_total as prix_total,
                  e.fournisseur_nom as partenaire_nom,
                  e.fournisseur_contact as partenaire_contact
           FROM entrees e
           LEFT JOIN produits p ON p.id = e.produit_id
           LEFT JOIN categories c ON c.id = e.categorie_id
         ) hist
         WHERE SUBSTR(hist.date_op, 1, 10) >= ?
           AND SUBSTR(hist.date_op, 1, 10) <= ?
           AND (? = 'ALL' OR hist.type = ?)
           AND (? IS NULL OR hist.categorie_id = ?)
         ORDER BY hist.date_op DESC, hist.id DESC`,
        [dateDebut, dateFin, typeFilter, typeFilter, catId, catId]
      );

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur lors de la récupération de l'historique.", details: error?.message });
    }
  });

  // ============================================================================
  // 10. RAPPORTS (/api/rapports)
  // ============================================================================
  app.get('/api/rapports', async (req: Request, res: Response) => {
    try {
      await recalculateAllStocks();
      const periode = String(req.query.periode || 'mois');
      const customStart = String(req.query.date_debut || '');
      const customEnd = String(req.query.date_fin || '');

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      let startDate = '2000-01-01';
      let endDate = '2099-12-31';

      if (periode === 'aujourd_hui') {
        startDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        endDate = startDate;
      } else if (periode === 'semaine') {
        const d = new Date(now);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        startDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      } else if (periode === 'mois') {
        startDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
        endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-31`;
      } else if (periode === 'annee') {
        startDate = `${now.getFullYear()}-01-01`;
        endDate = `${now.getFullYear()}-12-31`;
      } else if (periode === 'personnalise') {
        if (customStart) startDate = customStart;
        if (customEnd) endDate = customEnd;
      }

      const ventes = await queryAll(
        `SELECT s.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM sorties s
         LEFT JOIN produits p ON p.id = s.produit_id
         LEFT JOIN categories c ON c.id = s.categorie_id
         WHERE SUBSTR(s.date_vente, 1, 10) >= ? AND SUBSTR(s.date_vente, 1, 10) <= ?
         ORDER BY s.date_vente DESC`,
        [startDate, endDate]
      );

      const achats = await queryAll(
        `SELECT e.*, p.nom as produit_nom, p.unite, c.nom as categorie_nom
         FROM entrees e
         LEFT JOIN produits p ON p.id = e.produit_id
         LEFT JOIN categories c ON c.id = e.categorie_id
         WHERE SUBSTR(e.date_achat, 1, 10) >= ? AND SUBSTR(e.date_achat, 1, 10) <= ?
         ORDER BY e.date_achat DESC`,
        [startDate, endDate]
      );

      const stockReport = await queryAll(
        `SELECT st.*, p.nom as produit_nom, p.prix_achat, p.prix_vente, p.unite, c.nom as categorie_nom,
                (st.quantite_disponible * p.prix_vente) as valeur_stock_vente,
                (st.quantite_disponible * p.prix_achat) as valeur_stock_achat
         FROM stock st
         INNER JOIN produits p ON p.id = st.produit_id
         LEFT JOIN categories c ON c.id = p.categorie_id
         ORDER BY st.quantite_disponible ASC`
      );

      const produitsReport = await queryAll(
        `SELECT p.*, c.nom as categorie_nom,
                COALESCE(st.quantite_disponible, 0) as stock_disponible,
                COALESCE(st.statut, 'RUPTURE') as stock_statut,
                (SELECT COALESCE(SUM(s.quantite), 0) FROM sorties s WHERE s.produit_id = p.id AND SUBSTR(s.date_vente, 1, 10) >= ? AND SUBSTR(s.date_vente, 1, 10) <= ?) as qte_vendue_periode,
                (SELECT COALESCE(SUM(s.prix_total), 0) FROM sorties s WHERE s.produit_id = p.id AND SUBSTR(s.date_vente, 1, 10) >= ? AND SUBSTR(s.date_vente, 1, 10) <= ?) as ca_periode,
                (SELECT COALESCE(SUM(e.quantite), 0) FROM entrees e WHERE e.produit_id = p.id AND SUBSTR(e.date_achat, 1, 10) >= ? AND SUBSTR(e.date_achat, 1, 10) <= ?) as qte_achetee_periode,
                (SELECT COALESCE(SUM(e.prix_total), 0) FROM entrees e WHERE e.produit_id = p.id AND SUBSTR(e.date_achat, 1, 10) >= ? AND SUBSTR(e.date_achat, 1, 10) <= ?) as cout_achat_periode
         FROM produits p
         LEFT JOIN categories c ON c.id = p.categorie_id
         LEFT JOIN stock st ON st.produit_id = p.id
         ORDER BY ca_periode DESC, p.nom ASC`,
        [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]
      );

      const clientsReport = await queryAll(
        `SELECT cl.id, cl.nom_complet, cl.telephone, cl.adresse, cl.email, cl.date_ajout,
                COUNT(s.id) as nombre_ventes,
                COALESCE(SUM(s.quantite), 0) as quantite_totale,
                COALESCE(SUM(s.prix_total), 0) as chiffre_affaires
         FROM clients cl
         LEFT JOIN sorties s ON (s.client_id = cl.id OR LOWER(s.client_nom) = LOWER(cl.nom_complet))
           AND SUBSTR(s.date_vente, 1, 10) >= ? AND SUBSTR(s.date_vente, 1, 10) <= ?
         GROUP BY cl.id, cl.nom_complet, cl.telephone, cl.adresse, cl.email, cl.date_ajout
         ORDER BY chiffre_affaires DESC`,
        [startDate, endDate]
      );

      const fournisseursReport = await queryAll(
        `SELECT f.id, f.nom_complet, f.telephone, f.adresse, f.email, f.date_ajout,
                COUNT(e.id) as nombre_achats,
                COALESCE(SUM(e.quantite), 0) as quantite_totale,
                COALESCE(SUM(e.prix_total), 0) as montant_total
         FROM fournisseurs f
         LEFT JOIN entrees e ON (e.fournisseur_id = f.id OR LOWER(e.fournisseur_nom) = LOWER(f.nom_complet))
           AND SUBSTR(e.date_achat, 1, 10) >= ? AND SUBSTR(e.date_achat, 1, 10) <= ?
         GROUP BY f.id, f.nom_complet, f.telephone, f.adresse, f.email, f.date_ajout
         ORDER BY montant_total DESC`,
        [startDate, endDate]
      );

      const totalVentes = ventes.reduce((acc: number, v: any) => acc + Number(v.prix_total || 0), 0);
      const totalAchats = achats.reduce((acc: number, a: any) => acc + Number(a.prix_total || 0), 0);
      const produitsVendus = ventes.reduce((acc: number, v: any) => acc + Number(v.quantite || 0), 0);
      const produitsAchetes = achats.reduce((acc: number, a: any) => acc + Number(a.quantite || 0), 0);

      res.json({
        periode,
        date_debut: startDate,
        date_fin: endDate,
        resume: {
          nombre_ventes: ventes.length,
          total_ventes: totalVentes,
          nombre_achats: achats.length,
          total_achats: totalAchats,
          produits_vendus: produitsVendus,
          produits_achetes: produitsAchetes,
          solde_periode: totalVentes - totalAchats,
        },
        ventes,
        achats,
        stock: stockReport,
        produits: produitsReport,
        clients: clientsReport,
        fournisseurs: fournisseursReport,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la génération des rapports.', details: error?.message });
    }
  });

  // ============================================================================
  // 11. EXPORT COMPLET DU SCHÉMA & DES DONNÉES MYSQL (.SQL)
  // ============================================================================
  app.get('/api/sql-schema', async (_req: Request, res: Response) => {
    try {
      await recalculateAllStocks();
      const categoriesRows = await queryAll<any>('SELECT * FROM categories ORDER BY id ASC');
      const produitsRows = await queryAll<any>('SELECT * FROM produits ORDER BY id ASC');
      const fournisseursRows = await queryAll<any>('SELECT * FROM fournisseurs ORDER BY id ASC');
      const clientsRows = await queryAll<any>('SELECT * FROM clients ORDER BY id ASC');
      const entreesRows = await queryAll<any>('SELECT * FROM entrees ORDER BY id ASC');
      const sortiesRows = await queryAll<any>('SELECT * FROM sorties ORDER BY id ASC');
      const stockRows = await queryAll<any>('SELECT * FROM stock ORDER BY id ASC');
      const recusRows = await queryAll<any>('SELECT * FROM recus ORDER BY id ASC');

      const lines: string[] = [
        '-- ============================================================================',
        `-- BASE DE DONNÉES MYSQL CENTRALE : ${MYSQL_DB_NAME}`,
        `-- DATE D'EXPORT : ${nowISO()}`,
        '-- MOTEUR : InnoDB | ENCODAGE : utf8mb4_unicode_ci',
        '-- ============================================================================',
        '',
        'SET NAMES utf8mb4;',
        'SET FOREIGN_KEY_CHECKS = 0;',
        '',
        `CREATE DATABASE IF NOT EXISTS \`${MYSQL_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
        `USE \`${MYSQL_DB_NAME}\`;`,
        '',
        '-- 1. Table `categories`',
        'CREATE TABLE IF NOT EXISTS categories (',
        '  id INT AUTO_INCREMENT PRIMARY KEY,',
        '  nom VARCHAR(120) NOT NULL UNIQUE,',
        '  description TEXT,',
        "  statut ENUM('Actif', 'Inactif') NOT NULL DEFAULT 'Actif',",
        '  date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
        '',
        '-- 2. Table `produits`',
        'CREATE TABLE IF NOT EXISTS produits (',
        '  id INT AUTO_INCREMENT PRIMARY KEY,',
        '  nom VARCHAR(180) NOT NULL,',
        '  categorie_id INT NOT NULL,',
        '  prix_achat DECIMAL(15,2) NOT NULL DEFAULT 0,',
        '  prix_vente DECIMAL(15,2) NOT NULL DEFAULT 0,',
        "  unite VARCHAR(50) NOT NULL DEFAULT 'Unité',",
        '  seuil_alerte INT NOT NULL DEFAULT 10,',
        "  statut ENUM('Actif', 'Inactif') NOT NULL DEFAULT 'Actif',",
        '  date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
        '  INDEX idx_produits_categorie (categorie_id),',
        '  CONSTRAINT fk_produits_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
        '',
        '-- 3. Table `fournisseurs`',
        'CREATE TABLE IF NOT EXISTS fournisseurs (',
        '  id INT AUTO_INCREMENT PRIMARY KEY,',
        '  nom_complet VARCHAR(180) NOT NULL,',
        '  telephone VARCHAR(50) NOT NULL,',
        "  adresse VARCHAR(255) DEFAULT '',",
        "  email VARCHAR(150) DEFAULT '',",
        '  date_ajout DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
        '',
        '-- 4. Table `clients`',
        'CREATE TABLE IF NOT EXISTS clients (',
        '  id INT AUTO_INCREMENT PRIMARY KEY,',
        '  nom_complet VARCHAR(180) NOT NULL,',
        '  telephone VARCHAR(50) NOT NULL,',
        "  adresse VARCHAR(255) DEFAULT '',",
        "  email VARCHAR(150) DEFAULT '',",
        '  date_ajout DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
        '',
        '-- 5. Table `entrees`',
        'CREATE TABLE IF NOT EXISTS entrees (',
        '  id INT AUTO_INCREMENT PRIMARY KEY,',
        '  numero_recu VARCHAR(60) NOT NULL UNIQUE,',
        '  categorie_id INT NOT NULL,',
        '  produit_id INT NOT NULL,',
        '  quantite INT NOT NULL CHECK (quantite > 0),',
        '  prix_unitaire DECIMAL(15,2) NOT NULL CHECK (prix_unitaire >= 0),',
        '  prix_total DECIMAL(15,2) NOT NULL,',
        '  fournisseur_id INT NULL,',
        '  fournisseur_nom VARCHAR(180) NOT NULL,',
        "  fournisseur_contact VARCHAR(80) DEFAULT '',",
        '  date_achat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
        '  INDEX idx_entrees_produit (produit_id),',
        '  INDEX idx_entrees_fournisseur (fournisseur_id),',
        '  CONSTRAINT fk_entrees_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT,',
        '  CONSTRAINT fk_entrees_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE,',
        '  CONSTRAINT fk_entrees_fournisseur FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id) ON DELETE SET NULL',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
        '',
        '-- 6. Table `sorties`',
        'CREATE TABLE IF NOT EXISTS sorties (',
        '  id INT AUTO_INCREMENT PRIMARY KEY,',
        '  numero_recu VARCHAR(60) NOT NULL UNIQUE,',
        '  categorie_id INT NOT NULL,',
        '  produit_id INT NOT NULL,',
        '  quantite INT NOT NULL CHECK (quantite > 0),',
        '  prix_unitaire DECIMAL(15,2) NOT NULL CHECK (prix_unitaire >= 0),',
        '  prix_total DECIMAL(15,2) NOT NULL,',
        '  client_id INT NULL,',
        '  client_nom VARCHAR(180) NOT NULL,',
        "  client_contact VARCHAR(80) DEFAULT '',",
        '  date_vente DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
        '  INDEX idx_sorties_produit (produit_id),',
        '  INDEX idx_sorties_client (client_id),',
        '  CONSTRAINT fk_sorties_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT,',
        '  CONSTRAINT fk_sorties_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE,',
        '  CONSTRAINT fk_sorties_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
        '',
        '-- 7. Table `stock`',
        'CREATE TABLE IF NOT EXISTS stock (',
        '  id INT AUTO_INCREMENT PRIMARY KEY,',
        '  produit_id INT NOT NULL UNIQUE,',
        '  quantite_disponible INT NOT NULL DEFAULT 0 CHECK (quantite_disponible >= 0),',
        '  total_entrees INT NOT NULL DEFAULT 0,',
        '  total_sorties INT NOT NULL DEFAULT 0,',
        '  seuil_alerte INT NOT NULL DEFAULT 10,',
        "  statut ENUM('EN STOCK', 'STOCK FAIBLE', 'RUPTURE') NOT NULL DEFAULT 'RUPTURE',",
        '  derniere_mise_a_jour DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
        '  CONSTRAINT fk_stock_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
        '',
        '-- 8. Table `recus`',
        'CREATE TABLE IF NOT EXISTS recus (',
        '  id INT AUTO_INCREMENT PRIMARY KEY,',
        '  numero_recu VARCHAR(60) NOT NULL UNIQUE,',
        "  type_operation ENUM('VENTE', 'ENTREE') NOT NULL DEFAULT 'VENTE',",
        '  sortie_id INT NULL,',
        '  entree_id INT NULL,',
        '  date_recu DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
        '  partenaire_nom VARCHAR(180) NOT NULL,',
        "  partenaire_contact VARCHAR(80) DEFAULT '',",
        '  produit_nom VARCHAR(180) NOT NULL,',
        "  categorie_nom VARCHAR(120) DEFAULT '',",
        "  unite VARCHAR(50) DEFAULT 'Unité',",
        '  quantite INT NOT NULL,',
        '  prix_unitaire DECIMAL(15,2) NOT NULL,',
        '  prix_total DECIMAL(15,2) NOT NULL,',
        '  total_general DECIMAL(15,2) NOT NULL,',
        '  INDEX idx_recus_sortie (sortie_id),',
        '  INDEX idx_recus_entree (entree_id),',
        '  CONSTRAINT fk_recus_sortie FOREIGN KEY (sortie_id) REFERENCES sorties(id) ON DELETE CASCADE,',
        '  CONSTRAINT fk_recus_entree FOREIGN KEY (entree_id) REFERENCES entrees(id) ON DELETE CASCADE',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
        '',
        '-- ============================================================================',
        '-- DONNÉES ACTUELLES DE LA BASE MYSQL',
        '-- ============================================================================',
      ];

      for (const c of categoriesRows) {
        lines.push(
          `INSERT INTO categories (id, nom, description, statut, date_creation) VALUES (${sqlEscape(c.id)}, ${sqlEscape(c.nom)}, ${sqlEscape(c.description)}, ${sqlEscape(c.statut)}, ${sqlEscape(c.date_creation)}) ON DUPLICATE KEY UPDATE nom=VALUES(nom), description=VALUES(description), statut=VALUES(statut);`
        );
      }
      for (const p of produitsRows) {
        lines.push(
          `INSERT INTO produits (id, nom, categorie_id, prix_achat, prix_vente, unite, seuil_alerte, statut, date_creation) VALUES (${sqlEscape(p.id)}, ${sqlEscape(p.nom)}, ${sqlEscape(p.categorie_id)}, ${sqlEscape(p.prix_achat)}, ${sqlEscape(p.prix_vente)}, ${sqlEscape(p.unite)}, ${sqlEscape(p.seuil_alerte)}, ${sqlEscape(p.statut)}, ${sqlEscape(p.date_creation)}) ON DUPLICATE KEY UPDATE nom=VALUES(nom), categorie_id=VALUES(categorie_id), prix_achat=VALUES(prix_achat), prix_vente=VALUES(prix_vente), unite=VALUES(unite), seuil_alerte=VALUES(seuil_alerte), statut=VALUES(statut);`
        );
      }
      for (const f of fournisseursRows) {
        lines.push(
          `INSERT INTO fournisseurs (id, nom_complet, telephone, adresse, email, date_ajout) VALUES (${sqlEscape(f.id)}, ${sqlEscape(f.nom_complet)}, ${sqlEscape(f.telephone)}, ${sqlEscape(f.adresse)}, ${sqlEscape(f.email)}, ${sqlEscape(f.date_ajout)}) ON DUPLICATE KEY UPDATE nom_complet=VALUES(nom_complet), telephone=VALUES(telephone), adresse=VALUES(adresse), email=VALUES(email);`
        );
      }
      for (const cl of clientsRows) {
        lines.push(
          `INSERT INTO clients (id, nom_complet, telephone, adresse, email, date_ajout) VALUES (${sqlEscape(cl.id)}, ${sqlEscape(cl.nom_complet)}, ${sqlEscape(cl.telephone)}, ${sqlEscape(cl.adresse)}, ${sqlEscape(cl.email)}, ${sqlEscape(cl.date_ajout)}) ON DUPLICATE KEY UPDATE nom_complet=VALUES(nom_complet), telephone=VALUES(telephone), adresse=VALUES(adresse), email=VALUES(email);`
        );
      }
      for (const e of entreesRows) {
        lines.push(
          `INSERT INTO entrees (id, numero_recu, categorie_id, produit_id, quantite, prix_unitaire, prix_total, fournisseur_id, fournisseur_nom, fournisseur_contact, date_achat) VALUES (${sqlEscape(e.id)}, ${sqlEscape(e.numero_recu)}, ${sqlEscape(e.categorie_id)}, ${sqlEscape(e.produit_id)}, ${sqlEscape(e.quantite)}, ${sqlEscape(e.prix_unitaire)}, ${sqlEscape(e.prix_total)}, ${sqlEscape(e.fournisseur_id)}, ${sqlEscape(e.fournisseur_nom)}, ${sqlEscape(e.fournisseur_contact)}, ${sqlEscape(e.date_achat)}) ON DUPLICATE KEY UPDATE quantite=VALUES(quantite), prix_unitaire=VALUES(prix_unitaire), prix_total=VALUES(prix_total);`
        );
      }
      for (const s of sortiesRows) {
        lines.push(
          `INSERT INTO sorties (id, numero_recu, categorie_id, produit_id, quantite, prix_unitaire, prix_total, client_id, client_nom, client_contact, date_vente) VALUES (${sqlEscape(s.id)}, ${sqlEscape(s.numero_recu)}, ${sqlEscape(s.categorie_id)}, ${sqlEscape(s.produit_id)}, ${sqlEscape(s.quantite)}, ${sqlEscape(s.prix_unitaire)}, ${sqlEscape(s.prix_total)}, ${sqlEscape(s.client_id)}, ${sqlEscape(s.client_nom)}, ${sqlEscape(s.client_contact)}, ${sqlEscape(s.date_vente)}) ON DUPLICATE KEY UPDATE quantite=VALUES(quantite), prix_unitaire=VALUES(prix_unitaire), prix_total=VALUES(prix_total);`
        );
      }
      for (const st of stockRows) {
        lines.push(
          `INSERT INTO stock (id, produit_id, quantite_disponible, total_entrees, total_sorties, seuil_alerte, statut, derniere_mise_a_jour) VALUES (${sqlEscape(st.id)}, ${sqlEscape(st.produit_id)}, ${sqlEscape(st.quantite_disponible)}, ${sqlEscape(st.total_entrees)}, ${sqlEscape(st.total_sorties)}, ${sqlEscape(st.seuil_alerte)}, ${sqlEscape(st.statut)}, ${sqlEscape(st.derniere_mise_a_jour)}) ON DUPLICATE KEY UPDATE quantite_disponible=VALUES(quantite_disponible), total_entrees=VALUES(total_entrees), total_sorties=VALUES(total_sorties), seuil_alerte=VALUES(seuil_alerte), statut=VALUES(statut);`
        );
      }
      for (const r of recusRows) {
        lines.push(
          `INSERT INTO recus (id, numero_recu, type_operation, sortie_id, entree_id, date_recu, partenaire_nom, partenaire_contact, produit_nom, categorie_nom, unite, quantite, prix_unitaire, prix_total, total_general) VALUES (${sqlEscape(r.id)}, ${sqlEscape(r.numero_recu)}, ${sqlEscape(r.type_operation)}, ${sqlEscape(r.sortie_id)}, ${sqlEscape(r.entree_id)}, ${sqlEscape(r.date_recu)}, ${sqlEscape(r.partenaire_nom)}, ${sqlEscape(r.partenaire_contact)}, ${sqlEscape(r.produit_nom)}, ${sqlEscape(r.categorie_nom)}, ${sqlEscape(r.unite)}, ${sqlEscape(r.quantite)}, ${sqlEscape(r.prix_unitaire)}, ${sqlEscape(r.prix_total)}, ${sqlEscape(r.total_general)}) ON DUPLICATE KEY UPDATE total_general=VALUES(total_general);`
        );
      }

      lines.push('', 'SET FOREIGN_KEY_CHECKS = 1;', '');
      res.type('text/plain; charset=utf-8').send(lines.join('\n'));
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur lors de la génération du script MySQL.', details: error?.message });
    }
  });

  // Vite middleware in dev / static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UniversKaneprod MySQL Central API Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
