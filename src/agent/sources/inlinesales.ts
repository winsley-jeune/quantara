import { fetchSitemap, parseProductSlug } from './sitemapScraper';

export interface InlineSalesEntry {
  source: string;
  url: string;
  brand: string;
  part_number: string;
  slug_remainder: string;
}

const SITEMAP_URL = 'https://inlinesales.com/product-sitemap.xml';

export async function scrapeInlineSales(): Promise<InlineSalesEntry[]> {
  const urls = await fetchSitemap(SITEMAP_URL);
  // Filter to actual product URLs (skip /shop, category pages, etc.)
  const productUrls = urls.filter((u) => /\/product\/[^/]+\/?$/.test(u));
  const entries: InlineSalesEntry[] = [];
  for (const url of productUrls) {
    const parsed = parseProductSlug(url);
    if (!parsed) continue;
    entries.push({
      source: 'inlinesales-sitemap',
      url,
      brand: parsed.brand_hint,
      part_number: parsed.part_number_hint,
      slug_remainder: parsed.slug_remainder,
    });
  }
  return entries;
}
