// Vulcan Seals: 5,135 sitemap URLs (~1,457 unique English /products/ URLs).
// Each product URL is itself a Vulcan-to-OEM cross-reference encoded in the
// slug:
//   /products/Vulcan-Seals-Type-130-Xylem-Lowara
//     → Vulcan part type 130, fits Xylem-Lowara pumps
//   /products/Vulcan-Seals-Type-127B-KSB
//     → Vulcan part type 127B, fits KSB pumps
//
// Some URLs are generic seal types with no OEM brand suffix
// (e.g. Vulcan-Seals-Type-10) — those are Vulcan's standard products
// covering many OEMs and we keep them as 'GENERIC' brand.
import { fetchSitemap } from './sitemapScraper';

export interface VulcanEntry {
  source: string;
  url: string;
  vulcan_part_type: string;
  oem_brand: string;
  description: string;
}

const SITEMAP_URL = 'https://vulcanseals.com/sitemap.xml';

// Brand suffixes Vulcan uses in product URLs. We strip the leading
// "Vulcan-Seals-Type-XXX-" prefix and what remains is the OEM brand
// (and sometimes a sub-model). Compile after empirical inspection of
// the sitemap.
const KNOWN_OEM_SUFFIXES = [
  'Xylem-Lowara', 'Xylem', 'Lowara',
  'KSB', 'Wilo', 'Sterling-Sihi', 'Sterling', 'Sihi',
  'GEA-Hilge', 'GEA', 'Hilge',
  'WEMCO-Hidrostal', 'WEMCO', 'Hidrostal',
  'Bell-Gossett', 'Bell-and-Gossett', 'B-and-G',
  'Goulds', 'Aurora', 'Taco', 'Grundfos', 'Armstrong',
  'Viking', 'Flowserve', 'Worthington', 'ITT',
  'Ingersoll-Dresser', 'Ingersoll-Rand', 'IDP',
  'Gorman-Rupp', 'Cornell',
  'Peerless', 'Pacific-Pumping', 'PACO',
  'Crane-Pumps', 'Crane-Deming', 'Deming', 'Crane',
  'Hayward-Gordon', 'Hayward',
  'Pentair', 'Hayward-Pool', 'Sta-Rite',
  'Penn-Valley', 'Discflo', 'EnviroGear',
  'Marlow', 'ITT-Marlow',
  'Sulzer-APP', 'Sulzer-OHM', 'Sulzer-SHM', 'Sulzer',
  'Andritz', 'Allweiler',
  'Hilge-Hygia', 'APV',
  'Tuthill', 'Roper', 'Blackmer',
  'Pulsafeeder', 'Iwaki',
  'Gravity-Solid', 'Solid-Handling',
  'EBARA', 'Ebara',
  'KSB-Multitec', 'KSB-Etanorm',
  'John-Crane',
  'Jacuzzi',
  'Hayward-Tyler',
  'Bornemann', 'Netzsch', 'Seepex', 'Moyno',
  'Mouvex', 'Marlow', 'Vansan', 'Allchin',
  'SLM', 'Pleuger',
  'KSB-Amarex', 'KSB-Sewabloc',
  'Stuart-Turner',
  'Calpeda', 'Caprari', 'Pedrollo', 'DAB',
  'Sondex',
  'Spirax-Sarco', 'Sarco',
  'Wartsila',
  'Stanley',
];

function looksLikeProductTypeURL(url: string): boolean {
  // English (no /es/, /de/, /fr/, /it/ prefix) + /products/ + a Vulcan-Seals-* slug
  if (!/\/products\//.test(url)) return false;
  if (/\/(es|de|fr|it)\//.test(url)) return false;
  if (/\/products\/?$/.test(url)) return false;
  return true;
}

function parseVulcanSlug(slug: string): { type: string; brand: string; desc: string } {
  // Strip leading Vulcan-Seals- (and a few variants)
  let s = slug.replace(/^Vulcan-Seals-/i, '').replace(/^Vulcan-/i, '');
  // The type portion is "Type-NNN" or "Type-NNNB" etc.
  const typeMatch = s.match(/^Type-([A-Z0-9]+)/i);
  let type = '';
  if (typeMatch) {
    type = typeMatch[0];
    s = s.slice(type.length).replace(/^-+/, '');
  }
  // Now s is whatever's left — try matching against known OEM suffixes
  let brand = '';
  for (const suffix of KNOWN_OEM_SUFFIXES) {
    if (s === suffix || s.startsWith(`${suffix}-`) || s.endsWith(`-${suffix}`)) {
      brand = suffix.replace(/-/g, ' ');
      break;
    }
  }
  if (!brand && s) {
    // Best-effort: split by hyphen and call the first token the brand
    brand = s.split('-')[0]!.replace(/-/g, ' ');
  }
  return { type: type || slug, brand: brand || 'GENERIC', desc: s.replace(/-/g, ' ') };
}

export async function scrapeVulcanSeals(): Promise<VulcanEntry[]> {
  const urls = await fetchSitemap(SITEMAP_URL);
  const productUrls = urls.filter(looksLikeProductTypeURL);
  const seen = new Set<string>();
  const entries: VulcanEntry[] = [];
  for (const url of productUrls) {
    let slug = '';
    try {
      slug = decodeURIComponent(new URL(url).pathname).split('/').pop() ?? '';
    } catch {
      continue;
    }
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const { type, brand, desc } = parseVulcanSlug(slug);
    entries.push({
      source: 'vulcanseals-sitemap',
      url,
      vulcan_part_type: type,
      oem_brand: brand,
      description: desc,
    });
  }
  return entries;
}
