// Excel exporter for the SKU catalog. One sheet per source for now;
// later we can add a master 'All' sheet with normalized columns.
import ExcelJS from 'exceljs';
import type { USSealCrossRef } from '../sources/usseal';
import type { InlineSalesEntry } from '../sources/inlinesales';
import type { BoilerSuppliesEntry } from '../sources/boilersupplies';
import type { VulcanEntry } from '../sources/vulcanseals';
import type { JacksonSystemsEntry } from '../sources/jacksonsystems';
import type { PexEntry } from '../sources/pexuniverse';
import type { SupplyHouseEntry } from '../sources/supplyhouse';

export interface CatalogRow {
  source: string;
  category: string;
  oem_brand: string;
  oem_part_number: string;
  aftermarket_brand: string;
  aftermarket_part_number: string;
  pump_nameplate_data: string;
  search_query: string;
  monthly_search_volume: number | '';
  list_price_estimate: number | '';
  status: string;
}

export function ussealToCatalog(rows: USSealCrossRef[]): CatalogRow[] {
  return rows.map((r) => ({
    source: 'us-seal-mfg-pdf',
    category: 'pump-seal',
    oem_brand: r.oem_brand,
    oem_part_number: r.oem_part_number,
    aftermarket_brand: 'U.S. Seal Manufacturing',
    aftermarket_part_number: r.us_seal_part_number,
    pump_nameplate_data: r.pump_nameplate_data ?? '',
    search_query: `${r.oem_brand.split(' ')[0]} ${r.oem_part_number} seal`,
    monthly_search_volume: '',
    list_price_estimate: '',
    status: 'sourced',
  }));
}

export function inlinesalesToCatalog(rows: InlineSalesEntry[]): CatalogRow[] {
  return rows.map((r) => ({
    source: r.source,
    category: 'pump-or-circulator',
    oem_brand: r.brand,
    oem_part_number: r.part_number,
    aftermarket_brand: '',
    aftermarket_part_number: '',
    pump_nameplate_data: r.slug_remainder,
    search_query: `${r.brand} ${r.part_number}`,
    monthly_search_volume: '',
    list_price_estimate: '',
    status: 'sourced',
  }));
}

export function boilersuppliesToCatalog(rows: BoilerSuppliesEntry[]): CatalogRow[] {
  return rows.map((r) => ({
    source: r.source,
    category: 'pump-part',
    oem_brand: r.brand,
    oem_part_number: r.part_number,
    aftermarket_brand: '',
    aftermarket_part_number: '',
    pump_nameplate_data: r.slug_remainder,
    search_query: `${r.brand} ${r.part_number}`,
    monthly_search_volume: '',
    list_price_estimate: '',
    status: 'sourced',
  }));
}

export function supplyhouseToCatalog(rows: SupplyHouseEntry[]): CatalogRow[] {
  return rows.map((r) => ({
    source: r.source,
    category: 'mixed',
    oem_brand: r.brand,
    oem_part_number: r.part_number,
    aftermarket_brand: '',
    aftermarket_part_number: '',
    pump_nameplate_data: r.slug_remainder,
    search_query: `${r.brand} ${r.part_number}`,
    monthly_search_volume: '',
    list_price_estimate: '',
    status: 'sourced',
  }));
}

export function pexToCatalog(rows: PexEntry[]): CatalogRow[] {
  return rows.map((r) => ({
    source: r.source,
    category: 'pump-or-hvac',
    oem_brand: r.brand,
    oem_part_number: r.part_number,
    aftermarket_brand: '',
    aftermarket_part_number: '',
    pump_nameplate_data: r.slug_remainder,
    search_query: `${r.brand} ${r.part_number}`,
    monthly_search_volume: '',
    list_price_estimate: '',
    status: 'sourced',
  }));
}

export function jacksonsystemsToCatalog(rows: JacksonSystemsEntry[]): CatalogRow[] {
  return rows.map((r) => ({
    source: r.source,
    category: 'hvac-controls',
    oem_brand: r.brand,
    oem_part_number: r.part_number,
    aftermarket_brand: '',
    aftermarket_part_number: '',
    pump_nameplate_data: r.slug_remainder,
    search_query: `${r.brand} ${r.part_number}`,
    monthly_search_volume: '',
    list_price_estimate: '',
    status: 'sourced',
  }));
}

export function vulcanToCatalog(rows: VulcanEntry[]): CatalogRow[] {
  return rows.map((r) => ({
    source: r.source,
    category: 'pump-seal',
    oem_brand: r.oem_brand,
    oem_part_number: '', // Vulcan URLs are seal-type → OEM-brand cross-refs; no OEM part number at slug level
    aftermarket_brand: 'Vulcan Seals',
    aftermarket_part_number: r.vulcan_part_type,
    pump_nameplate_data: r.description,
    search_query: `${r.oem_brand} pump seal Vulcan ${r.vulcan_part_type}`,
    monthly_search_volume: '',
    list_price_estimate: '',
    status: 'sourced',
  }));
}

// Combine rows that share the same (oem_brand, oem_part_number) — same SKU
// found in multiple sources. We keep the first row's metadata and append
// alternative aftermarket equivalents + sources into combined fields.
export function dedupeCatalog(rows: CatalogRow[]): CatalogRow[] {
  const map = new Map<string, CatalogRow>();
  const altParts = new Map<string, Set<string>>();
  const altSources = new Map<string, Set<string>>();

  function keyOf(r: CatalogRow): string {
    const brand = r.oem_brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const part = r.oem_part_number.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!brand || !part) return '';
    return `${brand}::${part}`;
  }

  for (const r of rows) {
    const k = keyOf(r);
    if (!k) {
      // No part number → keep as-is, not dedupable
      map.set(`__nokey_${map.size}`, r);
      continue;
    }
    if (!map.has(k)) map.set(k, r);
    if (!altParts.has(k)) altParts.set(k, new Set());
    if (!altSources.has(k)) altSources.set(k, new Set());
    if (r.aftermarket_part_number) altParts.get(k)!.add(r.aftermarket_part_number);
    altSources.get(k)!.add(r.source);
  }

  const out: CatalogRow[] = [];
  for (const [k, row] of map.entries()) {
    if (k.startsWith('__nokey_')) {
      out.push(row);
      continue;
    }
    const allAfter = [...(altParts.get(k) ?? new Set<string>())].filter(Boolean).join(' | ');
    const allSrc = [...(altSources.get(k) ?? new Set<string>())].join(' | ');
    out.push({
      ...row,
      aftermarket_part_number: allAfter || row.aftermarket_part_number,
      source: allSrc,
    });
  }
  return out;
}

export async function writeCatalogExcel(path: string, rows: CatalogRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'quantara-agent';
  wb.created = new Date();

  const ws = wb.addWorksheet('Catalog');
  ws.columns = [
    { header: 'Source', key: 'source', width: 24 },
    { header: 'Category', key: 'category', width: 14 },
    { header: 'OEM Brand', key: 'oem_brand', width: 36 },
    { header: 'OEM Part #', key: 'oem_part_number', width: 20 },
    { header: 'Aftermarket Brand', key: 'aftermarket_brand', width: 28 },
    { header: 'Aftermarket Part #', key: 'aftermarket_part_number', width: 22 },
    { header: 'Pump / Nameplate Data', key: 'pump_nameplate_data', width: 40 },
    { header: 'Search Query', key: 'search_query', width: 36 },
    { header: 'Est. Monthly Searches', key: 'monthly_search_volume', width: 18 },
    { header: 'List Price Estimate', key: 'list_price_estimate', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const r of rows) {
    ws.addRow(r);
  }

  // Stats sheet
  const stats = wb.addWorksheet('Stats');
  stats.columns = [
    { header: 'Metric', key: 'metric', width: 40 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  stats.getRow(1).font = { bold: true };
  const uniqueOEM = new Set(rows.map((r) => r.oem_part_number)).size;
  const uniqueAftermarket = new Set(rows.map((r) => r.aftermarket_part_number)).size;
  const uniqueBrands = new Set(rows.map((r) => r.oem_brand)).size;
  stats.addRow({ metric: 'Total rows', value: rows.length });
  stats.addRow({ metric: 'Unique OEM parts', value: uniqueOEM });
  stats.addRow({ metric: 'Unique Aftermarket parts', value: uniqueAftermarket });
  stats.addRow({ metric: 'Unique OEM brands', value: uniqueBrands });

  // Per-brand sheet
  const byBrand = new Map<string, number>();
  for (const r of rows) byBrand.set(r.oem_brand, (byBrand.get(r.oem_brand) ?? 0) + 1);
  const brandsSheet = wb.addWorksheet('Brands');
  brandsSheet.columns = [
    { header: 'OEM Brand', key: 'brand', width: 50 },
    { header: 'Row count', key: 'count', width: 12 },
  ];
  brandsSheet.getRow(1).font = { bold: true };
  for (const [brand, count] of [...byBrand.entries()].sort((a, b) => b[1] - a[1])) {
    brandsSheet.addRow({ brand, count });
  }

  await wb.xlsx.writeFile(path);
}
