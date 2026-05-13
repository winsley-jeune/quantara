// PEXUniverse: plumbing + HVAC + pump distributor with ~8,911 product URLs.
// Slugs are very rich: brand-partnumber-description, e.g.
//   /taco-005-020rp-pump-replacement-cartridge
//   /grundfos-up10-16apm-bu-lc-pump-98420224
//   /honeywell-v8043e1061-zone-valve
import { fetchSitemap, parseProductSlug } from './sitemapScraper';

export interface PexEntry {
  source: string;
  url: string;
  brand: string;
  part_number: string;
  slug_remainder: string;
}

const SITEMAP_URL = 'https://pexuniverse.com/sitemap_products.xml';

// Skip generic plumbing fittings — they don't have meaningful brand/part-number
// pairs for cross-reference. Keep brand-prefixed slugs.
const SKIP_SLUG_PATTERNS = [
  /^\d+(-\d+)?-copper/,
  /^\d+(-\d+)?-brass/,
  /^\d+(-\d+)?-pvc/,
  /^\d+(-\d+)?-cpvc/,
  /^\d+(-\d+)?-pex/,
  /^\d+(-\d+)?-malleable/,
  /^\d+(-\d+)?-galvanized/,
  /^\d+(-\d+)?-stainless/,
  /^\d+(-\d+)?-black-iron/,
  /^\d+(-\d+)?-female-threaded/,
  /^\d+(-\d+)?-male-threaded/,
  /^spears-/,
  /^cpvc-/,
];

function shouldSkip(slug: string): boolean {
  const lower = slug.toLowerCase();
  return SKIP_SLUG_PATTERNS.some((p) => p.test(lower));
}

export async function scrapePEXUniverse(): Promise<PexEntry[]> {
  const urls = await fetchSitemap(SITEMAP_URL);
  const entries: PexEntry[] = [];
  for (const url of urls) {
    let slug = '';
    try {
      slug = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    } catch {
      continue;
    }
    if (!slug || slug.includes('/')) continue; // PEX uses flat /slug URLs
    if (shouldSkip(slug)) continue;
    const parsed = parseProductSlug(url);
    if (!parsed) continue;
    entries.push({
      source: 'pexuniverse-sitemap',
      url,
      brand: parsed.brand_hint,
      part_number: parsed.part_number_hint,
      slug_remainder: parsed.slug_remainder,
    });
  }
  return entries;
}
