import type { Request, Response } from 'express';
import {
  listMasterProducts,
  countMasterProducts,
  type MasterProduct,
} from '../models/db';
import { buildWorkbook } from '../services/excelWriter';

function parseLimit(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 10_000);
}

export function listProducts(req: Request, res: Response): void {
  const limit = parseLimit(req.query.limit, 500);
  const products = listMasterProducts(limit);
  const counts = countMasterProducts();
  res.json({ counts, count: products.length, products });
}

export async function downloadProductsWorkbook(
  req: Request,
  res: Response,
): Promise<void> {
  const limit = parseLimit(req.query.limit, 5000);
  const products: MasterProduct[] = listMasterProducts(limit);
  // MasterProduct extends Product with extra metadata; the writer only reads
  // Product fields so we pass it as-is.
  const buffer = await buildWorkbook(products);
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="quantara-master-${stamp}.xlsx"`,
  );
  res.send(buffer);
}
