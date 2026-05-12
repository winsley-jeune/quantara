// SellerAmp (SAS) deep-link builder.
//
// The `/r/sas/lookup` redirect endpoint accepts a UPC (or ASIN) as
// `search_term` and lets SAS resolve it to the correct ASIN server-side.
// `src=ext` marks the lookup as coming from a 3rd-party tool — same flag the
// SAS Quick browser extension uses. We use UPC because that's the
// identifier Quantara has; SAS does the UPC → ASIN matching for us.
//
// Example:
//   sasLookupUrl('794775002320')
//   → https://sas.selleramp.com/r/sas/lookup?search_term=794775002320&src=ext
export function sasLookupUrl(identifier: string): string {
  const safe = encodeURIComponent(identifier);
  return `https://sas.selleramp.com/r/sas/lookup?search_term=${safe}&src=ext`;
}
