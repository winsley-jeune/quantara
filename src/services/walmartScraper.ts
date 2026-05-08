import type { Page } from 'puppeteer';
import { withPage } from '../utils/puppeteer';
import { WALMART_CONFIG } from '../config/walmart';
import type { RawWalmartItem } from '../models/product';

const NEXT_DATA_SELECTOR = 'script#__NEXT_DATA__';

interface NextData {
  props?: {
    pageProps?: {
      initialData?: unknown;
    };
  };
}

export class WalmartBlockedError extends Error {
  constructor(message = 'Walmart returned a bot-challenge page') {
    super(message);
    this.name = 'WalmartBlockedError';
  }
}

async function loadNextData(
  page: Page,
  url: string,
  timeoutMs = WALMART_CONFIG.pageRenderTimeoutMs,
): Promise<NextData> {
  await page.setUserAgent(WALMART_CONFIG.userAgent);
  await page.setViewport(WALMART_CONFIG.viewport);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

  const title = await page.title();
  if (/robot or human/i.test(title)) {
    throw new WalmartBlockedError(`bot challenge: ${title}`);
  }

  try {
    await page.waitForSelector(NEXT_DATA_SELECTOR, { timeout: timeoutMs });
  } catch (err) {
    const recheck = await page.title();
    if (/robot or human/i.test(recheck)) {
      throw new WalmartBlockedError(`bot challenge after wait: ${recheck}`);
    }
    throw err;
  }
  const raw = await page.$eval(NEXT_DATA_SELECTOR, (el) => el.textContent ?? '');
  if (!raw) throw new Error('__NEXT_DATA__ was empty');
  return JSON.parse(raw) as NextData;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function absoluteUrl(href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `https://www.walmart.com${href}`;
  return href;
}

// Walmart's tree drifts between releases. Walk anything that looks like a list
// of itemStacks and pull product-shaped entries.
function findItems(node: unknown): unknown[] {
  const found: unknown[] = [];
  const queue: unknown[] = [node];
  const seen = new WeakSet<object>();
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object') continue;
    if (seen.has(cur as object)) continue;
    seen.add(cur as object);

    if (Array.isArray(cur)) {
      queue.push(...cur);
      continue;
    }
    const obj = cur as Record<string, unknown>;

    if (Array.isArray(obj.itemStacks)) {
      for (const stack of obj.itemStacks as Array<Record<string, unknown>>) {
        if (Array.isArray(stack.items)) found.push(...(stack.items as unknown[]));
      }
    }

    for (const key of Object.keys(obj)) queue.push(obj[key]);
  }
  return found;
}

function mapItem(raw: unknown): RawWalmartItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const id =
    asString(o.usItemId) ??
    asString(o.id) ??
    asString(o.productId) ??
    asString((o.productInfo as Record<string, unknown> | undefined)?.usItemId);
  if (!id) return null;

  const name =
    asString(o.name) ??
    asString(o.title) ??
    asString((o.productInfo as Record<string, unknown> | undefined)?.title);
  if (!name) return null;

  const brand =
    asString(o.brand) ??
    asString((o.productInfo as Record<string, unknown> | undefined)?.brand);

  const priceObj = (o.priceInfo as Record<string, unknown> | undefined) ?? (o.price as Record<string, unknown> | undefined) ?? {};
  const linePrice = asString(
    (priceObj.linePrice as string | undefined) ??
      (priceObj.priceString as string | undefined) ??
      (priceObj.currentPrice as Record<string, unknown> | undefined)?.priceString,
  );
  const priceAmount =
    asNumber(priceObj.price) ??
    asNumber((priceObj.currentPrice as Record<string, unknown> | undefined)?.price) ??
    asNumber(linePrice);

  const path =
    asString(o.canonicalUrl) ??
    asString(o.productPageUrl) ??
    asString(o.canonical) ??
    (id ? `/ip/${id}` : null);

  const image =
    asString((o.imageInfo as Record<string, unknown> | undefined)?.thumbnailUrl) ??
    asString((o.image as Record<string, unknown> | undefined)?.url) ??
    asString(o.thumbnailImage);

  const availability =
    asString((o.availabilityStatusV2 as Record<string, unknown> | undefined)?.display) ??
    asString(o.availabilityStatus) ??
    null;

  return {
    id,
    name,
    brand,
    priceAmount,
    priceRaw: linePrice,
    url: absoluteUrl(path) ?? `https://www.walmart.com/ip/${id}`,
    imageUrl: absoluteUrl(image),
    availability,
  };
}

export async function scrapeCategory(url: string): Promise<RawWalmartItem[]> {
  return withPage(async (page) => {
    const data = await loadNextData(page, url);
    const rawItems = findItems(data.props?.pageProps?.initialData);
    const items: RawWalmartItem[] = [];
    const seen = new Set<string>();
    for (const raw of rawItems) {
      const mapped = mapItem(raw);
      if (!mapped) continue;
      if (seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      items.push(mapped);
      if (items.length >= WALMART_CONFIG.maxItemsPerFeed) break;
    }
    return items;
  });
}

interface PdpDetails {
  upc: string | null;
  gtin: string | null;
}

function extractPdpIdentifiers(node: unknown): PdpDetails {
  const queue: unknown[] = [node];
  const seen = new WeakSet<object>();
  let upc: string | null = null;
  let gtin: string | null = null;
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object') continue;
    if (seen.has(cur as object)) continue;
    seen.add(cur as object);

    if (Array.isArray(cur)) {
      queue.push(...cur);
      continue;
    }
    const obj = cur as Record<string, unknown>;
    if (!upc) upc = asString(obj.upc) ?? asString(obj.upcNumber);
    if (!gtin) gtin = asString(obj.gtin) ?? asString(obj.gtin13) ?? asString(obj.gtin14);
    if (upc && gtin) return { upc, gtin };
    for (const key of Object.keys(obj)) queue.push(obj[key]);
  }
  return { upc, gtin };
}

export async function fetchPdpIdentifiers(url: string): Promise<PdpDetails> {
  return withPage(async (page) => {
    // Shorter timeout for PDPs — Walmart will rate-limit us into a 60s wait
    // for every blocked request, which makes scans unusable. Fail fast and
    // let the runner stop the rest of the enrichment when blocks pile up.
    const data = await loadNextData(page, url, 15_000);
    return extractPdpIdentifiers(data.props?.pageProps?.initialData);
  });
}
