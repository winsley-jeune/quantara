import { randomUUID } from 'node:crypto';
import { WALMART_FEED_URLS } from '../config/walmart';
import {
  scrapeCategory,
  fetchPdpIdentifiers,
  WalmartBlockedError,
} from './walmartScraper';
import { recycleBrowser } from '../utils/puppeteer';
import { toProduct } from './productMapper';
import { isBrandBlocked } from './brandFilter';
import {
  insertScan,
  updateScan,
  insertProducts,
  upsertMasterProducts,
} from '../models/db';
import type { Product, RawWalmartItem } from '../models/product';
import type { ScanRecord } from '../models/scan';

// Pacing constants — kept top-of-file so they're easy to tune as we learn
// more about Walmart's tolerance. Operating principle: stay under 50% of
// whatever empirical rate Walmart will accept. Reliability over speed —
// blocked scans burn IP reputation and cost us hours of cooldown.
const PDP_DELAY_MS = 3000; // 1 req / 3s; ~50% of the 1.5s pace that worked
const MAX_CONSECUTIVE_PDP_FAILURES = 4;
const FEED_BASE_COOLDOWN_MS = 60_000; // sleep this long between feeds
const FEED_COOLDOWN_MAX_MS = 10 * 60_000; // ceiling on adaptive backoff
const RECYCLE_BROWSER_BETWEEN_FEEDS = true;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Sequential, paced enrichment. Walmart's anti-bot wall on PDPs means
// concurrent or fast requests get blocked after the first few. We stop
// enriching once consecutive failures (or an explicit bot-challenge) exceed
// the cap, and return the partial results plus a flag so the orchestrator
// can apply heavier backoff before the next feed.
async function enrich(
  rawItems: RawWalmartItem[],
  scanId: string,
): Promise<{ products: Product[]; blocked: boolean }> {
  const products: Product[] = [];
  let consecutiveFailures = 0;
  let halted = false;
  let sawBlock = false;
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
      if (blocked) sawBlock = true;
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
  return { products, blocked: sawBlock };
}

async function processFeed(
  url: string,
  scanId: string,
): Promise<{ products: Product[]; blocked: boolean }> {
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

// Long-running orchestrator. Runs each feed sequentially, persisting partial
// results after every feed so a crash mid-scan doesn't lose work, and
// applying adaptive backoff when Walmart starts blocking us.
async function runScan(id: string, feedUrls: string[]): Promise<void> {
  const seen = new Set<string>();
  const products: Product[] = [];
  const feedErrors: string[] = [];
  let cooldown = FEED_BASE_COOLDOWN_MS;

  for (let i = 0; i < feedUrls.length; i++) {
    const url = feedUrls[i]!;
    let feedBlocked = false;
    try {
      const { products: feedProducts, blocked } = await processFeed(url, id);
      feedBlocked = blocked;
      const fresh: Product[] = [];
      for (const p of feedProducts) {
        if (seen.has(p.sourceId)) continue;
        seen.add(p.sourceId);
        products.push(p);
        fresh.push(p);
      }
      // Checkpoint: persist this feed's products + bump productCount before
      // moving to the next feed. If the next feed crashes the process, we
      // still keep what we got from this one.
      if (fresh.length) {
        insertProducts(id, fresh);
        upsertMasterProducts(fresh);
      }
      updateScan(id, { productCount: products.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[scanRunner] ${id} feed failed (${url}): ${msg}`);
      feedErrors.push(`${url}: ${msg}`);
      if (err instanceof WalmartBlockedError) feedBlocked = true;
    }

    // Adaptive backoff. If Walmart blocked us during this feed, double the
    // cooldown (capped). If the feed went clean, halve back toward baseline.
    if (feedBlocked) {
      cooldown = Math.min(cooldown * 2, FEED_COOLDOWN_MAX_MS);
    } else {
      cooldown = Math.max(FEED_BASE_COOLDOWN_MS, cooldown / 2);
    }

    const isLast = i === feedUrls.length - 1;
    if (!isLast) {
      if (RECYCLE_BROWSER_BETWEEN_FEEDS) {
        await recycleBrowser().catch((e) =>
          console.warn(`[scanRunner] ${id} recycleBrowser warn:`, e),
        );
      }
      console.log(
        `[scanRunner] ${id} cooldown ${Math.round(cooldown / 1000)}s before next feed`,
      );
      await sleep(cooldown);
    }
  }

  const upcCount = products.filter((p) => p.upc).length;
  updateScan(id, {
    status: 'completed',
    finishedAt: new Date().toISOString(),
    productCount: products.length,
    errorMessage: feedErrors.length ? feedErrors.join(' | ') : null,
  });
  console.log(
    `[scanRunner] ${id} completed: ${products.length} products, ${upcCount} with UPC, ${feedErrors.length} feed errors`,
  );
}
