import { randomUUID } from 'node:crypto';
import { WALMART_CONFIG, WALMART_FEED_URLS } from '../config/walmart';
import {
  scrapeCategory,
  fetchPdpIdentifiers,
  WalmartBlockedError,
} from './walmartScraper';
import { toProduct } from './productMapper';
import { isBrandBlocked } from './brandFilter';
import { insertScan, updateScan, insertProducts } from '../models/db';
import type { Product, RawWalmartItem } from '../models/product';
import type { ScanRecord } from '../models/scan';

const PDP_DELAY_MS = 1500;
const MAX_CONSECUTIVE_PDP_FAILURES = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Sequential, paced enrichment. Walmart's anti-bot wall on PDPs means
// concurrent or fast requests get blocked after the first few. We stop
// enriching once consecutive failures (or an explicit bot-challenge) exceed
// the cap, and return the partial results — the user still gets the workbook
// with category-level data and whatever UPCs we managed to grab.
async function enrich(
  rawItems: RawWalmartItem[],
  scanId: string,
): Promise<Product[]> {
  const products: Product[] = [];
  let consecutiveFailures = 0;
  let halted = false;
  for (const item of rawItems) {
    if (halted) {
      products.push(toProduct(item, { upc: null, gtin: null }));
      continue;
    }
    try {
      const ids = await fetchPdpIdentifiers(item.url);
      products.push(toProduct(item, ids));
      consecutiveFailures = 0;
      await sleep(PDP_DELAY_MS);
    } catch (err) {
      const blocked = err instanceof WalmartBlockedError;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[scanRunner] ${scanId} PDP fetch failed for ${item.id}${
          blocked ? ' (blocked)' : ''
        }: ${msg}`,
      );
      products.push(toProduct(item, { upc: null, gtin: null }));
      consecutiveFailures++;
      if (blocked || consecutiveFailures >= MAX_CONSECUTIVE_PDP_FAILURES) {
        console.warn(
          `[scanRunner] ${scanId} stopping PDP enrichment after ${consecutiveFailures} failures; returning partial results`,
        );
        halted = true;
      }
    }
  }
  return products;
}

async function processFeed(url: string, scanId: string): Promise<Product[]> {
  console.log(`[scanRunner] ${scanId} scraping ${url}`);
  const rawItems: RawWalmartItem[] = await scrapeCategory(url);
  // Drop blocked brands before PDP enrichment — no point spending rate-limited
  // PDP requests on items we'll throw away.
  const kept = rawItems.filter((item) => !isBrandBlocked(item.brand));
  const dropped = rawItems.length - kept.length;
  console.log(
    `[scanRunner] ${scanId} ${url} → ${rawItems.length} items, ${dropped} brand-blocked, enriching ${kept.length}`,
  );
  return enrich(kept, scanId);
}

export function startScan(feedUrls: string[] = WALMART_FEED_URLS): ScanRecord {
  const id = randomUUID();
  const record: ScanRecord = {
    id,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    feedUrls,
    productCount: 0,
    errorMessage: null,
  };
  insertScan(record);

  void runScan(id, feedUrls).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scanRunner] scan ${id} failed:`, message);
    updateScan(id, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      errorMessage: message,
    });
  });

  return record;
}

async function runScan(id: string, feedUrls: string[]): Promise<void> {
  const seen = new Set<string>();
  const products: Product[] = [];
  for (const url of feedUrls) {
    const feedProducts = await processFeed(url, id);
    for (const p of feedProducts) {
      if (seen.has(p.sourceId)) continue;
      seen.add(p.sourceId);
      products.push(p);
    }
  }
  if (products.length) insertProducts(id, products);
  const upcCount = products.filter((p) => p.upc).length;
  updateScan(id, {
    status: 'completed',
    finishedAt: new Date().toISOString(),
    productCount: products.length,
  });
  console.log(
    `[scanRunner] ${id} completed: ${products.length} products, ${upcCount} with UPC`,
  );
  // Suppress unused-config warning — pdpConcurrency stays in config.ts as a
  // hint for when we revisit anti-bot strategy.
  void WALMART_CONFIG.pdpConcurrency;
}
