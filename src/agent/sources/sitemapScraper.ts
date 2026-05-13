// Generic sitemap-driven SKU extractor.
//
// For sites whose product URLs encode the SKU in the slug (e.g.
// inlinesales.com /product/bell-gossett-179360lf-1-25aab-2hp), we parse
// the slug directly — zero HTTP calls per product, instant catalog.
//
// For sites where the slug doesn't carry the SKU cleanly, we'll fall back
// to per-page HTML parsing in a separate module.

import { load } from 'cheerio';

export interface SitemapEntry {
  url: string;
  source: string;
}

export interface SlugParsedSKU {
  source: string;
  url: string;
  brand_hint: string;
  part_number_hint: string;
  slug_remainder: string;
}

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function fetchSitemap(url: string): Promise<string[]> {
  const resp = await fetch(url, { headers: FETCH_HEADERS });
  if (!resp.ok) throw new Error(`sitemap fetch failed: ${resp.status} ${url}`);
  const xml = await resp.text();
  // Recursively expand sitemap-of-sitemaps if needed.
  const sitemapRefs = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/g)].map(
    (m) => m[1]!,
  );
  if (sitemapRefs.length) {
    const all: string[] = [];
    for (const child of sitemapRefs) {
      try {
        const more = await fetchSitemap(child);
        all.push(...more);
      } catch (err) {
        console.warn(`  child sitemap failed: ${child}: ${(err as Error).message}`);
      }
    }
    return all;
  }
  const urls = [...xml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g)].map(
    (m) => m[1]!,
  );
  // Some sitemaps don't wrap <loc> in <url>; fall back to any <loc>.
  if (!urls.length) {
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  }
  return urls;
}

// Parse a product URL slug like:
//   /product/bell-gossett-179360lf-1-25aab-2hp
// → brand=Bell & Gossett, part_number_hint=179360LF, remainder=1-25AAB 2HP
//
// Strategy:
//   1. Split slug on '/' and find the segment after 'product' (or last)
//   2. Tokenize by '-'
//   3. First 1-3 tokens that match common brand prefixes → brand
//   4. The first token containing 2+ digits = part number candidate
//   5. Remainder = the rest
export function parseProductSlug(url: string): SlugParsedSKU | null {
  let pathPart = '';
  try {
    pathPart = new URL(url).pathname;
  } catch {
    return null;
  }
  if (!pathPart) return null;
  const segments = pathPart.split('/').filter(Boolean);
  if (!segments.length) return null;
  // Take the last segment (the slug); some sites use /product/<slug>, others
  // /shop/<slug>, etc.
  const slug = segments[segments.length - 1]!;
  if (slug.length < 4) return null;

  const tokens = slug.split('-').filter(Boolean);
  if (tokens.length < 2) return null;

  // Brand prefix matching — common multi-word brands
  const brandPrefixes: Array<{ tokens: string[]; canonical: string }> = [
    { tokens: ['bell', 'gossett'], canonical: 'Bell & Gossett' },
    { tokens: ['bell', 'and', 'gossett'], canonical: 'Bell & Gossett' },
    { tokens: ['b', 'and', 'g'], canonical: 'Bell & Gossett' },
    { tokens: ['ingersoll', 'dresser'], canonical: 'Ingersoll-Dresser' },
    { tokens: ['gorman', 'rupp'], canonical: 'Gorman-Rupp' },
    { tokens: ['armstrong'], canonical: 'Armstrong' },
    { tokens: ['taco'], canonical: 'Taco' },
    { tokens: ['grundfos'], canonical: 'Grundfos' },
    { tokens: ['goulds'], canonical: 'Goulds' },
    { tokens: ['aurora'], canonical: 'Aurora' },
    { tokens: ['viking'], canonical: 'Viking' },
    { tokens: ['flowserve'], canonical: 'Flowserve' },
    { tokens: ['worthington'], canonical: 'Worthington' },
    { tokens: ['john', 'crane'], canonical: 'John Crane' },
    { tokens: ['chesterton'], canonical: 'Chesterton' },
    { tokens: ['eagle', 'burgmann'], canonical: 'EagleBurgmann' },
    { tokens: ['us', 'seal'], canonical: 'U.S. Seal' },
    { tokens: ['ussealmfg'], canonical: 'U.S. Seal' },
    { tokens: ['vulcan'], canonical: 'Vulcan' },
    { tokens: ['ast'], canonical: 'AST' },
    { tokens: ['ppc'], canonical: 'PPC Mechanical Seals' },
    { tokens: ['sepco'], canonical: 'SEPCO' },
    { tokens: ['mepco'], canonical: 'Mepco' },
    { tokens: ['hoffman'], canonical: 'Hoffman' },
    { tokens: ['lockwood'], canonical: 'Lockwood' },
    { tokens: ['weinman'], canonical: 'Weinman' },
    { tokens: ['fairbanks'], canonical: 'Fairbanks Morse' },
    { tokens: ['ge'], canonical: 'GE' },
    { tokens: ['hartford'], canonical: 'Hartford' },
    { tokens: ['power', 'flo'], canonical: 'Power-Flo' },
    { tokens: ['power-flo'], canonical: 'Power-Flo' },
    { tokens: ['belimo'], canonical: 'Belimo' },
    { tokens: ['honeywell'], canonical: 'Honeywell' },
    { tokens: ['johnson', 'controls'], canonical: 'Johnson Controls' },
    { tokens: ['siemens'], canonical: 'Siemens' },
    { tokens: ['schneider'], canonical: 'Schneider' },
    { tokens: ['setra'], canonical: 'Setra' },
    { tokens: ['veris'], canonical: 'Veris' },
    { tokens: ['aci'], canonical: 'ACI' },
    { tokens: ['kmc'], canonical: 'KMC Controls' },
    { tokens: ['bapi'], canonical: 'BAPI' },
    { tokens: ['greystone'], canonical: 'Greystone' },
    { tokens: ['mamac'], canonical: 'Mamac Systems' },
    { tokens: ['functional', 'devices'], canonical: 'Functional Devices' },
    { tokens: ['dwyer'], canonical: 'Dwyer' },
    { tokens: ['trane'], canonical: 'Trane' },
    { tokens: ['carrier'], canonical: 'Carrier' },
  ];

  let brandTokensConsumed = 0;
  let canonical = '';
  for (const bp of brandPrefixes) {
    const matches = bp.tokens.every(
      (bt, i) => (tokens[i] ?? '').toLowerCase() === bt,
    );
    if (matches) {
      brandTokensConsumed = bp.tokens.length;
      canonical = bp.canonical;
      break;
    }
  }
  if (!brandTokensConsumed) {
    // Default: first token is the brand (e.g. "armstrong-S-25...")
    canonical = (tokens[0] ?? '').toUpperCase();
    brandTokensConsumed = 1;
  }

  const remaining = tokens.slice(brandTokensConsumed);
  // Find first token that looks like a part number: contains digit AND
  // either matches typical patterns (179360LF, 1-25aab, etc.).
  let partNumberHint = '';
  let partNumberIdx = -1;
  for (let i = 0; i < remaining.length; i++) {
    const t = remaining[i]!;
    const digits = t.replace(/[^0-9]/g, '').length;
    if (digits >= 2 && /^[a-z0-9-]+$/i.test(t)) {
      partNumberHint = t.toUpperCase();
      partNumberIdx = i;
      break;
    }
  }
  if (!partNumberHint) return null;

  const slugRemainder = remaining
    .filter((_, i) => i !== partNumberIdx)
    .join(' ')
    .replace(/[-_]/g, ' ');

  return {
    source: '',
    url,
    brand_hint: canonical,
    part_number_hint: partNumberHint,
    slug_remainder: slugRemainder.trim(),
  };
}

// Optional: fetch and parse an HTML product page to enrich the slug-derived
// SKU with title/price/SKU code from page content. Used for sources where
// the slug isn't reliable.
export async function fetchProductHTML(
  url: string,
): Promise<{ title: string; sku: string | null; price_raw: string | null }> {
  const resp = await fetch(url, { headers: FETCH_HEADERS });
  if (!resp.ok) throw new Error(`product fetch failed: ${resp.status} ${url}`);
  const html = await resp.text();
  const $ = load(html);
  const title =
    $('h1.product_title').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    '';
  // SKU from JSON-LD or WooCommerce span
  const sku =
    $('span.sku').first().text().trim() ||
    (html.match(/"sku"\s*:\s*"([^"]+)"/) ?? [])[1] ||
    null;
  const price_raw =
    $('p.price').first().text().trim() ||
    $('span.price').first().text().trim() ||
    (html.match(/"price"\s*:\s*"([^"]+)"/) ?? [])[1] ||
    null;
  return { title, sku, price_raw };
}
