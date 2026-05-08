// Walmart category/search URLs to scan. Use Amazon-ungated categories only —
// see memory/reference_amazon_gating.md. Edit freely; one URL per line.
export const WALMART_FEED_URLS: string[] = [
  'https://www.walmart.com/search?q=office+organizer',
  'https://www.walmart.com/search?q=dog+toys',
  'https://www.walmart.com/search?q=hand+tools',
];

export const WALMART_CONFIG = {
  pageRenderTimeoutMs: 60_000,
  pdpConcurrency: 4,
  maxItemsPerFeed: 60,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 900 },
};

// Brands we filter out before they reach the workbook. Two reasons to block:
//   1. Walmart house brands cannot be listed on Amazon at all (Walmart-exclusive).
//   2. Heavily brand-gated brands on Amazon — a new seller can't list them
//      without Brand Registry approval, so they're noise in the sourcing list.
//
// Matching is normalized: lowercased, non-alphanumerics stripped. So "Onn.",
// "ONN", and "onn" all match "onn". If you have approval for a brand on this
// list, remove it here.
export const BLOCKED_BRANDS: string[] = [
  // Walmart-exclusive house brands (un-listable on Amazon)
  'Mainstays',
  'Equate',
  'Great Value',
  'Sam\'s Choice',
  'Marketside',
  'Parent\'s Choice',
  'Athletic Works',
  'Hyper Tough',
  'Ozark Trail',
  'Onn',
  'Pen+Gear',
  'Pen Gear',
  'George',
  'Time and Tru',
  'Wonder Nation',
  'Faded Glory',
  'Spring Valley',
  'Allswell',
  'No Boundaries',
  'Terra & Sky',

  // Commonly Brand-Registry gated on Amazon for new sellers
  'Apple',
  'Bose',
  'Sony',
  'Samsung',
  'Sennheiser',
  'Fitbit',
  'GoPro',
  'Beats',
  'Logitech',
  'Canon',
  'Nikon',
  'Nike',
  'Adidas',
  'Under Armour',
  'Asics',
  'LEGO',
  'Disney',
  'Nintendo',
  'Funko',
  'National Geographic',
  'Dyson',
  'Shark',
  'OXO',
  'Breville',
  'KitchenAid',
  'Calphalon',
  'Pyrex',
  'Le Creuset',
  'Vitamix',
  'Ninja',
  'Instant Pot',
  'DeWalt',
  'Milwaukee',
  'Makita',
  'Bosch',
  'YETI',
  'Hydro Flask',
  'Stanley',
];
