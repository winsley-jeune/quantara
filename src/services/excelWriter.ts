import ExcelJS from 'exceljs';
import type { Product } from '../models/product';

// Filter applied at workbook-time only — raw data stays in DB. Drop products
// without a usable price; they're useless for arbitrage and dilute the
// SAS-review queue.
function isWorkbookEligible(p: Product): boolean {
  return typeof p.price.amount === 'number' && p.price.amount > 0;
}

// Deterministic first-sale ranking score. No Amazon-side data required.
// Designed to surface products most likely to convert quickly through SAS:
//   - UPC present (critical for clean SAS lookup)
//   - Price in $10–$50 arb sweet spot
//   - Has a real brand name
//   - Listed as in stock
//
// Max score = 10. Top-50 sheet ranks descending.
function scoreProduct(p: Product): number {
  let score = 0;

  if (p.upc) score += 3;
  if (p.gtin) score += 1;

  const price = p.price.amount;
  if (typeof price === 'number') {
    if (price >= 10 && price <= 50) score += 3;
    else if (price >= 5 && price <= 100) score += 1;
  }

  if (p.brand && p.brand.trim().length > 0) score += 2;

  const avail = (p.availability || '').toLowerCase();
  if (avail.includes('in stock') || avail.includes('available')) score += 1;

  return score;
}

const COLUMNS = [
  { header: 'Score', key: 'score', width: 8 },
  { header: 'Title', key: 'title', width: 50 },
  { header: 'Brand', key: 'brand', width: 20 },
  { header: 'Price', key: 'price', width: 12 },
  { header: 'Walmart URL', key: 'url', width: 50 },
  { header: 'UPC', key: 'upc', width: 16 },
  { header: 'GTIN', key: 'gtin', width: 16 },
  { header: 'Image', key: 'image', width: 50 },
  { header: 'Walmart ID', key: 'sourceId', width: 16 },
  { header: 'Availability', key: 'availability', width: 16 },
];

function fillSheet(ws: ExcelJS.Worksheet, products: Array<Product & { score: number }>): void {
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const p of products) {
    const row = ws.addRow({
      score: p.score,
      title: p.title,
      brand: p.brand ?? '',
      price: p.price.amount ?? '',
      url: p.url,
      upc: p.upc ?? '',
      gtin: p.gtin ?? '',
      image: p.imageUrl ?? '',
      sourceId: p.sourceId,
      availability: p.availability ?? '',
    });
    row.getCell('url').value = { text: p.url, hyperlink: p.url };
    row.getCell('url').font = { color: { argb: 'FF0563C1' }, underline: true };
    if (p.imageUrl) {
      row.getCell('image').value = { text: p.imageUrl, hyperlink: p.imageUrl };
      row.getCell('image').font = { color: { argb: 'FF0563C1' }, underline: true };
    }
    if (typeof p.price.amount === 'number') {
      row.getCell('price').numFmt = '"$"#,##0.00';
    }
    // Highlight high-score rows so they stand out at a glance
    if (p.score >= 8) {
      row.getCell('score').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB7E1A1' }, // light green
      };
    } else if (p.score >= 6) {
      row.getCell('score').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE599' }, // light yellow
      };
    }
  }
}

export async function buildWorkbook(products: Product[]): Promise<Buffer> {
  const eligible = products.filter(isWorkbookEligible);
  const scored = eligible.map((p) => ({ ...p, score: scoreProduct(p) }));
  // Top-50 sheet ranks descending so the user reviews highest-confidence rows
  // first in SAS. "All" sheet keeps insertion order so they can still browse.
  const top50 = [...scored].sort((a, b) => b.score - a.score).slice(0, 50);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'quantara';
  wb.created = new Date();

  fillSheet(wb.addWorksheet('Top 50'), top50);
  fillSheet(wb.addWorksheet('All'), scored);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
