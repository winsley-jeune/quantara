import { Router } from 'express';
import {
  listProducts,
  downloadProductsWorkbook,
} from '../controllers/products.controller';

const router = Router();

router.get('/products', listProducts);
router.get('/products/workbook', (req, res, next) => {
  downloadProductsWorkbook(req, res).catch(next);
});

export default router;
