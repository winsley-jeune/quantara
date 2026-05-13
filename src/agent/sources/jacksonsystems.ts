// Jackson Systems: HVAC controls + parts. 8 product sitemaps, ~1,601 URLs.
// URLs encode brand-partnumber-description with rich detail like:
//   /product/carrier-hn51kc024-oem-1-pole-24-v-coil-30-amp-hvac-contactor
import { fetchSitemap, parseProductSlug } from './sitemapScraper';

export interface JacksonSystemsEntry {
  source: string;
  url: string;
  brand: string;
  part_number: string;
  slug_remainder: string;
}

const SITEMAP_URLS = [
  'https://jacksonsystems.com/product-sitemap1.xml',
  'https://jacksonsystems.com/product-sitemap2.xml',
  'https://jacksonsystems.com/product-sitemap3.xml',
  'https://jacksonsystems.com/product-sitemap4.xml',
  'https://jacksonsystems.com/product-sitemap5.xml',
  'https://jacksonsystems.com/product-sitemap6.xml',
  'https://jacksonsystems.com/product-sitemap7.xml',
  'https://jacksonsystems.com/product-sitemap8.xml',
];

export async function scrapeJacksonSystems(): Promise<JacksonSystemsEntry[]> {
  const entries: JacksonSystemsEntry[] = [];
  for (const sm of SITEMAP_URLS) {
    try {
      const urls = await fetchSitemap(sm);
      for (const url of urls) {
        if (!/\/product\/[^/]+\/?$/.test(url)) continue;
        // Decode URL-encoded characters like %e2%80%91 (non-breaking hyphen)
        let decoded = url;
        try {
          decoded = decodeURIComponent(url);
        } catch {
          /* keep raw */
        }
        const parsed = parseProductSlug(decoded);
        if (!parsed) continue;
        entries.push({
          source: 'jacksonsystems-sitemap',
          url,
          brand: parsed.brand_hint,
          part_number: parsed.part_number_hint,
          slug_remainder: parsed.slug_remainder,
        });
      }
    } catch (err) {
      console.warn(`  jackson sitemap ${sm} failed:`, (err as Error).message);
    }
  }
  return entries;
}
