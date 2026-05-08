import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env';
import type { ScanRecord, ScanStatus } from './scan';
import type { Product } from './product';

let db: Database.Database | null = null;

function connect(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });
  db = new Database(env.dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      feed_urls TEXT NOT NULL,
      product_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );
    CREATE TABLE IF NOT EXISTS scan_products (
      scan_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (scan_id, source_id),
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_scan_products_scan ON scan_products(scan_id);

    CREATE TABLE IF NOT EXISTS master_products (
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      times_seen INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (source, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_master_last_seen ON master_products(last_seen_at);
  `);
  return db;
}

function rowToScan(row: Record<string, unknown>): ScanRecord {
  return {
    id: row.id as string,
    status: row.status as ScanStatus,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    feedUrls: JSON.parse(row.feed_urls as string) as string[],
    productCount: Number(row.product_count),
    errorMessage: (row.error_message as string | null) ?? null,
  };
}

export function insertScan(scan: ScanRecord): void {
  connect()
    .prepare(
      `INSERT INTO scans (id, status, started_at, finished_at, feed_urls, product_count, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      scan.id,
      scan.status,
      scan.startedAt,
      scan.finishedAt,
      JSON.stringify(scan.feedUrls),
      scan.productCount,
      scan.errorMessage,
    );
}

export function updateScan(
  id: string,
  patch: Partial<Pick<ScanRecord, 'status' | 'finishedAt' | 'productCount' | 'errorMessage'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.status !== undefined) {
    fields.push('status = ?');
    values.push(patch.status);
  }
  if (patch.finishedAt !== undefined) {
    fields.push('finished_at = ?');
    values.push(patch.finishedAt);
  }
  if (patch.productCount !== undefined) {
    fields.push('product_count = ?');
    values.push(patch.productCount);
  }
  if (patch.errorMessage !== undefined) {
    fields.push('error_message = ?');
    values.push(patch.errorMessage);
  }
  if (!fields.length) return;
  values.push(id);
  connect().prepare(`UPDATE scans SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getRunningScan(): ScanRecord | null {
  const row = connect()
    .prepare("SELECT * FROM scans WHERE status = 'running' ORDER BY started_at DESC LIMIT 1")
    .get() as Record<string, unknown> | undefined;
  return row ? rowToScan(row) : null;
}

export function getScan(id: string): ScanRecord | null {
  const row = connect().prepare('SELECT * FROM scans WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToScan(row) : null;
}

export function listScans(limit = 50): ScanRecord[] {
  const rows = connect()
    .prepare('SELECT * FROM scans ORDER BY started_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map(rowToScan);
}

export function insertProducts(scanId: string, products: Product[]): void {
  const stmt = connect().prepare(
    `INSERT OR REPLACE INTO scan_products (scan_id, source_id, payload) VALUES (?, ?, ?)`,
  );
  const tx = connect().transaction((items: Product[]) => {
    for (const p of items) stmt.run(scanId, p.sourceId, JSON.stringify(p));
  });
  tx(products);
}

export function getProducts(scanId: string): Product[] {
  const rows = connect()
    .prepare('SELECT payload FROM scan_products WHERE scan_id = ?')
    .all(scanId) as Array<{ payload: string }>;
  return rows.map((r) => JSON.parse(r.payload) as Product);
}

// Cross-scan deduplicated catalog. Each call upserts the product, bumping
// times_seen and lastSeenAt. firstSeenAt is preserved on conflict.
export function upsertMasterProducts(products: Product[]): void {
  const now = new Date().toISOString();
  const stmt = connect().prepare(`
    INSERT INTO master_products (source, source_id, payload, first_seen_at, last_seen_at, times_seen)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(source, source_id) DO UPDATE SET
      payload = excluded.payload,
      last_seen_at = excluded.last_seen_at,
      times_seen = master_products.times_seen + 1
  `);
  const tx = connect().transaction((items: Product[]) => {
    for (const p of items) stmt.run(p.source, p.sourceId, JSON.stringify(p), now, now);
  });
  tx(products);
}

export interface MasterProduct extends Product {
  firstSeenAt: string;
  lastSeenAt: string;
  timesSeen: number;
}

export function listMasterProducts(limit = 5000): MasterProduct[] {
  const rows = connect()
    .prepare(
      `SELECT payload, first_seen_at, last_seen_at, times_seen
       FROM master_products
       ORDER BY last_seen_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    payload: string;
    first_seen_at: string;
    last_seen_at: string;
    times_seen: number;
  }>;
  return rows.map((r) => ({
    ...(JSON.parse(r.payload) as Product),
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    timesSeen: Number(r.times_seen),
  }));
}

export function countMasterProducts(): { total: number; withUpc: number } {
  const total = connect()
    .prepare('SELECT COUNT(*) AS c FROM master_products')
    .get() as { c: number };
  const withUpc = connect()
    .prepare(
      `SELECT COUNT(*) AS c FROM master_products
       WHERE json_extract(payload, '$.upc') IS NOT NULL
         AND json_extract(payload, '$.upc') != ''`,
    )
    .get() as { c: number };
  return { total: Number(total.c), withUpc: Number(withUpc.c) };
}
