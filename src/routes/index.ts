import { Router } from 'express';
import scanRoutes from './scan.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use(scanRoutes);

export default router;
