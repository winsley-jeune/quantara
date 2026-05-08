// One-off debug: render a Walmart page with a fresh browser and dump
// (a) whether __NEXT_DATA__ exists, (b) any first-item field keys present in
// the category JSON, and (c) the page title — so we can see if Walmart is
// serving us a captcha or different markup.
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser } from 'puppeteer';

puppeteerExtra.use(StealthPlugin());

async function main(): Promise<void> {
  const url = process.argv[2] ?? 'https://www.walmart.com/search?q=cereal';
  const browser = (await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  })) as unknown as Browser;
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    );
    await page.setViewport({ width: 1366, height: 900 });
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    console.log('status:', resp?.status());
    const title = await page.title();
    console.log('title:', title);
    const hasNext = await page.evaluate(
      () => document.querySelector('script#__NEXT_DATA__') !== null,
    );
    console.log('has __NEXT_DATA__:', hasNext);
    const html = await page.content();
    console.log('html length:', html.length);
    console.log('first 500 chars:', html.slice(0, 500));

    if (hasNext) {
      const raw = await page.$eval('script#__NEXT_DATA__', (el) => el.textContent ?? '');
      const data = JSON.parse(raw);
      const items: unknown[] = [];
      function walk(node: unknown): void {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          for (const x of node) walk(x);
          return;
        }
        const o = node as Record<string, unknown>;
        if (Array.isArray(o.itemStacks)) {
          for (const s of o.itemStacks as Array<Record<string, unknown>>) {
            if (Array.isArray(s.items)) items.push(...(s.items as unknown[]));
          }
        }
        for (const k of Object.keys(o)) walk(o[k]);
      }
      walk(data?.props?.pageProps?.initialData);
      console.log('items found:', items.length);
      if (items.length) {
        const first = items[0] as Record<string, unknown>;
        console.log('item keys:', Object.keys(first).sort().join(', '));
        const upcKeys = JSON.stringify(first).match(/"(upc|gtin|gtin13|gtin14|sku)":/gi);
        console.log('upc/gtin keys present:', upcKeys);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
