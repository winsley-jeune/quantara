import express from 'express';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler } from './middlewares/errorHandler';
import apiRoutes from './routes';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  app.use('/api', apiRoutes);
  app.use(errorHandler);
  return app;
}
