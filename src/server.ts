import { createApp } from './app';
import { env } from './config/env';
import { closeBrowser } from './utils/puppeteer';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`quantara listening on http://localhost:${env.port}`);
});

// Unhandled rejections from puppeteer-core / stealth-plugin during browser
// recycle (Page.addScriptToEvaluateOnNewDocument timing out when the browser
// goes away mid-handler) would otherwise crash the whole Node process and
// kill any in-flight scan. Log and continue — scanRunner already handles
// per-PDP failures and will retry on the next page.
process.on('unhandledRejection', (err: unknown) => {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.warn('[server] unhandledRejection (continuing):', msg);
});

process.on('uncaughtException', (err: Error) => {
  console.warn('[server] uncaughtException (continuing):', err.message);
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
