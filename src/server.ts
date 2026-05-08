import { createApp } from './app';
import { env } from './config/env';
import { closeBrowser } from './utils/puppeteer';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`quantara listening on http://localhost:${env.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] received ${signal}, shutting down`);
  server.close();
  await closeBrowser().catch((err) => {
    console.warn('[server] error closing browser:', err);
  });
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
