import 'dotenv/config';
import path from 'node:path';

export const env = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.QUANTARA_DB ?? path.resolve(process.cwd(), 'data/quantara.db'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
