import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';

puppeteerExtra.use(StealthPlugin());

// Restart the browser every N page-uses to rotate the headless fingerprint.
// Walmart fingerprints repeat sessions and starts blocking after a stretch of
// uses; a fresh process gives us a new fingerprint and clears any flagged
// cookies/localStorage. Conservative default (15) per the 50%-rate-budget
// directive — recycling more often than strictly necessary keeps scans
// reliable when running unattended.
const BROWSER_RECYCLE_AFTER = Number(process.env.QUANTARA_BROWSER_RECYCLE_AFTER ?? 15);

let browserPromise: Promise<Browser> | null = null;
let pagesServed = 0;

async function launch(): Promise<Browser> {
  return puppeteerExtra.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  }) as unknown as Browser;
}

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch();
    pagesServed = 0;
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    browserPromise = null;
    pagesServed = 0;
    await browser.close();
  }
}

export async function recycleBrowser(): Promise<void> {
  console.log('[puppeteer] recycling browser to rotate fingerprint');
  await closeBrowser();
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  if (pagesServed >= BROWSER_RECYCLE_AFTER) {
    await recycleBrowser();
  }
  const browser = await getBrowser();
  pagesServed++;
  const page = await browser.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {
      /* ignore */
    });
  }
}
