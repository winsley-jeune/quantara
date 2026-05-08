import type { Request, Response } from 'express';
import { startScan } from '../services/scanRunner';
import { buildWorkbook } from '../services/excelWriter';
import { getScan, listScans, getProducts } from '../models/db';
import { WALMART_FEED_URLS } from '../config/walmart';

export function createScan(req: Request, res: Response): void {
  const body = (req.body ?? {}) as { feedUrls?: unknown };
  let feedUrls = WALMART_FEED_URLS;
  if (Array.isArray(body.feedUrls)) {
    if (!body.feedUrls.every((u) => typeof u === 'string' && u.startsWith('http'))) {
      res.status(400).json({ error: 'feedUrls must be an array of http(s) strings' });
      return;
    }
    feedUrls = body.feedUrls as string[];
  }
  const scan = startScan(feedUrls);
  res.status(202).json(scan);
}

export function getScans(_req: Request, res: Response): void {
  res.json({ scans: listScans(50) });
}

export function getScanById(req: Request, res: Response): void {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  const scan = getScan(id);
  if (!scan) {
    res.status(404).json({ error: 'scan not found' });
    return;
  }
  const products = getProducts(id);
  res.json({ scan, products });
}

export async function downloadWorkbook(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  const scan = getScan(id);
  if (!scan) {
    res.status(404).json({ error: 'scan not found' });
    return;
  }
  if (scan.status !== 'completed') {
    res.status(409).json({ error: `scan is ${scan.status}, workbook not ready` });
    return;
  }
  const products = getProducts(id);
  const buffer = await buildWorkbook(products);
  const stamp = scan.startedAt.replace(/[:T]/g, '-').slice(0, 19);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="quantara-${stamp}.xlsx"`);
  res.send(buffer);
}
