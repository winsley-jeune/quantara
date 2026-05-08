// Walmart category/search URLs grouped by Amazon-ungated category.
// Source: memory/reference_amazon_gating.md. Each query is intentionally
// specific to dodge Walmart house brands and Brand-Registry-gated brands.
//
// To run a scan against a different mix, pass `feedUrls` in the POST body
// (see controllers/scan.controller.ts) — e.g.:
//   curl -X POST localhost:3000/api/scans -H 'content-type: application/json' \
//     -d "$(jq -n --argjson f "$(jq -n --argjson c '...' '$c.tools')" '{feedUrls:$f}')"
//
// Or edit `WALMART_FEED_URLS` below to change the default scan.

export const CATEGORY_FEEDS = {
  pet: [
    'https://www.walmart.com/search?q=dog+rope+toy',
    'https://www.walmart.com/search?q=cat+scratching+post',
    'https://www.walmart.com/search?q=aquarium+decor',
    'https://www.walmart.com/search?q=bird+cage+accessories',
    'https://www.walmart.com/search?q=reptile+heat+lamp',
  ],
  office: [
    'https://www.walmart.com/search?q=desk+organizer',
    'https://www.walmart.com/search?q=label+maker+tape',
    'https://www.walmart.com/search?q=binder+clips+assorted',
    'https://www.walmart.com/search?q=hanging+file+folders',
    'https://www.walmart.com/search?q=whiteboard+markers+pack',
  ],
  tools: [
    'https://www.walmart.com/search?q=cabinet+hinges',
    'https://www.walmart.com/search?q=drawer+slides+ball+bearing',
    'https://www.walmart.com/search?q=caulk+gun',
    'https://www.walmart.com/search?q=pvc+pipe+fittings',
    'https://www.walmart.com/search?q=outdoor+extension+cord+50ft',
  ],
  sports: [
    'https://www.walmart.com/search?q=resistance+bands+set',
    'https://www.walmart.com/search?q=foam+roller+18+inch',
    'https://www.walmart.com/search?q=fishing+lures+freshwater',
    'https://www.walmart.com/search?q=archery+arrows+carbon',
    'https://www.walmart.com/search?q=camping+lantern+led',
  ],
  homeKitchen: [
    'https://www.walmart.com/search?q=shower+curtain+liner',
    'https://www.walmart.com/search?q=silicone+baking+mat',
    'https://www.walmart.com/search?q=throw+pillow+covers+18x18',
    'https://www.walmart.com/search?q=mason+jars+wide+mouth',
    'https://www.walmart.com/search?q=bath+towels+cotton+set',
    'https://www.walmart.com/search?q=cutting+board+bamboo',
  ],
  toys: [
    'https://www.walmart.com/search?q=jigsaw+puzzle+1000+piece',
    'https://www.walmart.com/search?q=board+game+family',
    'https://www.walmart.com/search?q=playing+cards+deck',
    'https://www.walmart.com/search?q=stem+building+toys',
    'https://www.walmart.com/search?q=plush+stuffed+animals',
  ],
  arts: [
    'https://www.walmart.com/search?q=acrylic+paint+set',
    'https://www.walmart.com/search?q=embroidery+floss+set',
    'https://www.walmart.com/search?q=sewing+machine+needles',
    'https://www.walmart.com/search?q=knitting+needles+circular',
    'https://www.walmart.com/search?q=scrapbook+paper+pad',
  ],
  music: [
    'https://www.walmart.com/search?q=ukulele+soprano',
    'https://www.walmart.com/search?q=guitar+strings+acoustic',
    'https://www.walmart.com/search?q=piano+keyboard+stand',
    'https://www.walmart.com/search?q=drum+sticks+5a',
  ],
  industrial: [
    'https://www.walmart.com/search?q=nitrile+gloves+box',
    'https://www.walmart.com/search?q=safety+glasses+anti+fog',
    'https://www.walmart.com/search?q=zip+ties+assorted',
    'https://www.walmart.com/search?q=microscope+slides+blank',
    'https://www.walmart.com/search?q=ph+test+strips',
  ],
  baby: [
    'https://www.walmart.com/search?q=baby+bibs+silicone',
    'https://www.walmart.com/search?q=baby+swaddle+blanket+muslin',
    'https://www.walmart.com/search?q=baby+teether+silicone',
    'https://www.walmart.com/search?q=baby+bottle+brush',
  ],
  garden: [
    'https://www.walmart.com/search?q=garden+hose+50ft',
    'https://www.walmart.com/search?q=raised+garden+bed',
    'https://www.walmart.com/search?q=bird+feeder+squirrel+proof',
    'https://www.walmart.com/search?q=outdoor+solar+lights+pathway',
    'https://www.walmart.com/search?q=garden+kneeler+seat',
  ],
} as const;

// Default scan — small enough to finish in ~10 min. Edit this set or pass
// `feedUrls` in the POST body to scan a different mix.
export const WALMART_FEED_URLS: string[] = [
  ...CATEGORY_FEEDS.office,
  ...CATEGORY_FEEDS.pet.slice(0, 2),
  ...CATEGORY_FEEDS.tools.slice(0, 2),
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
  "Sam's Choice",
  'Marketside',
  "Parent's Choice",
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
