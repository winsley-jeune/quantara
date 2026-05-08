import { Router } from 'express';
import scanRoutes from './scan.routes';
import productRoutes from './products.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use(scanRoutes);
router.use(productRoutes);

export default router;
