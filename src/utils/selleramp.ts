// Phase 2 helper. Builds a SAS Lookup deep link from an Amazon ASIN.
// Not used in Phase 1 because we don't have ASINs yet — kept here so the
// workbook writer can opt in once ASIN matching lands.
export function sasLookupUrl(asin: string): string {
  const safe = encodeURIComponent(asin);
  return `https://sas.selleramp.com/sas/lookup?search_term=${safe}&asin=${safe}`;
}
