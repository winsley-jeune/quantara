// BoilerSupplies has a flat sitemap with both category and product URLs.
// We pick out URLs that look like product detail pages (typically
// /category-slug/product-slug/<numeric-id>) and parse the SKU from the
// product-slug segment.
import { fetchSitemap, parseProductSlug } from './sitemapScraper';

export interface BoilerSuppliesEntry {
  source: string;
  url: string;
  brand: string;
  part_number: string;
  slug_remainder: string;
}

const SITEMAP_URL = 'https://www.boilersupplies.com/sitemap.xml';

export async function scrapeBoilerSupplies(): Promise<BoilerSuppliesEntry[]> {
  const urls = await fetchSitemap(SITEMAP_URL);
  // Product pages end in /<numeric-id>
  const productUrls = urls.filter((u) => /\/\d+\/?$/.test(u));
  const entries: BoilerSuppliesEntry[] = [];
  for (const url of productUrls) {
    // BoilerSupplies URL: /category-slug/product-slug/123
    // We want the product-slug (second-to-last segment).
    let path = '';
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    // Reconstruct a URL with just the product slug for parseProductSlug
    const productSlug = parts[parts.length - 2]!;
    const fakeUrl = `https://www.boilersupplies.com/product/${productSlug}`;
    const parsed = parseProductSlug(fakeUrl);
    if (!parsed) continue;
    entries.push({
      source: 'boilersupplies-sitemap',
      url,
      brand: parsed.brand_hint,
      part_number: parsed.part_number_hint,
      slug_remainder: parsed.slug_remainder,
    });
  }
  return entries;
}
