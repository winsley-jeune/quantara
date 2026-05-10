import ExcelJS from 'exceljs';
import type { Product } from '../models/product';

// Filter applied at workbook-time only — raw data stays in DB. Drop products
// without a usable price; they're useless for arbitrage and dilute the
// SAS-review queue.
function isWorkbookEligible(p: Product): boolean {
  return typeof p.price.amount === 'number' && p.price.amount > 0;
}

export async function buildWorkbook(products: Product[]): Promise<Buffer> {
  const eligible = products.filter(isWorkbookEligible);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'quantara';
  wb.created = new Date();

  const ws = wb.addWorksheet('Walmart');
  ws.columns = [
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

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const p of eligible) {
    const row = ws.addRow({
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
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
