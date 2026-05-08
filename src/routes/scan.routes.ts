import { Router } from 'express';
import {
  createScan,
  createFullScan,
  getScans,
  getScanById,
  downloadWorkbook,
} from '../controllers/scan.controller';

const router = Router();

router.post('/scans', createScan);
router.post('/scans/full', createFullScan);
router.get('/scans', getScans);
router.get('/scans/:id', getScanById);
router.get('/scans/:id/workbook', (req, res, next) => {
  downloadWorkbook(req, res).catch(next);
});

export default router;
