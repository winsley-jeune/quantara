// SupplyHouse.com: 9 product sitemaps × 50K URLs = ~450K product URLs.
// Plain HTTP returns 403; stealth Puppeteer reads the sitemap fine.
// Each slug encodes brand + part number + description, e.g.:
//   /ENVIRO-TEC-00-00052-01-Cover-Electrical-Enclosure-2-Sided-18Ga-00-00052-01
//   /Knipex-00-11-01-3-3-4-TwinKey-Universal-Control-Cabinet-Key
//
// Strategy: fetch each sitemap via Puppeteer, parse slugs, dedupe. We
// don't need per-product HTTP calls — the slug carries everything we want.
import { getBrowser } from '../../utils/puppeteer';
import { parseProductSlug } from './sitemapScraper';

export interface SupplyHouseEntry {
  source: string;
  url: string;
  brand: string;
  part_number: string;
  slug_remainder: string;
}

const SITEMAP_INDEX = 'https://www.supplyhouse.com/sitemap.xml';

async function fetchSitemapViaPuppeteer(url: string): Promise<string[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    );
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const text = await page.evaluate(() => document.body.innerText);
    const urls = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    return urls;
  } finally {
    await page.close().catch(() => {
      /* ignore */
    });
  }
}

export async function scrapeSupplyHouse(
  options: { maxUrls?: number } = {},
): Promise<SupplyHouseEntry[]> {
  const maxUrls = options.maxUrls ?? 50_000;
  const indexUrls = await fetchSitemapViaPuppeteer(SITEMAP_INDEX);
  const productSitemaps = indexUrls.filter((u) => /sitemap_products_\d+\.xml/.test(u));
  console.log(
    `  supplyhouse: ${productSitemaps.length} product sitemaps; will pull up to ${maxUrls} URLs`,
  );

  const allUrls: string[] = [];
  for (const sm of productSitemaps) {
    if (allUrls.length >= maxUrls) break;
    const urls = await fetchSitemapViaPuppeteer(sm);
    allUrls.push(...urls);
    console.log(`  supplyhouse: ${sm.split('/').pop()} → ${urls.length} URLs (running total ${allUrls.length})`);
  }

  const entries: SupplyHouseEntry[] = [];
  const seen = new Set<string>();
  for (const url of allUrls.slice(0, maxUrls)) {
    const parsed = parseProductSlug(url);
    if (!parsed) continue;
    const key = `${parsed.brand_hint.toLowerCase()}::${parsed.part_number_hint.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      source: 'supplyhouse-sitemap',
      url,
      brand: parsed.brand_hint,
      part_number: parsed.part_number_hint,
      slug_remainder: parsed.slug_remainder,
    });
  }
  return entries;
}
