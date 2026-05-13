// Probe SupplyHouse: does stealth Puppeteer let us fetch the sitemap?
// If yes, that's a clean 10K+ SKU source.
import { getBrowser, closeBrowser } from '../src/utils/puppeteer';

async function main(): Promise<void> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  );
  await page.setViewport({ width: 1366, height: 900 });

  for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/robots.txt']) {
    const url = `https://www.supplyhouse.com${path}`;
    console.log(`GET ${url}`);
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('  status:', resp?.status());
      const body = await page.evaluate(() => document.body.innerText);
      console.log('  body length:', body.length);
      console.log('  first 500:', body.slice(0, 500));
    } catch (err) {
      console.log('  failed:', (err as Error).message);
    }
  }

  // Also try to fetch a category page
  const catUrl = 'https://www.supplyhouse.com/Pumps-21-Page-1';
  console.log(`\nGET ${catUrl}`);
  try {
    const resp = await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('  status:', resp?.status());
    const title = await page.title();
    console.log('  title:', title);
    const html = await page.content();
    console.log('  html length:', html.length);
    // Look for product link patterns
    const productLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="-p/"]'))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((h) => h.includes('supplyhouse.com'));
      return [...new Set(links)].slice(0, 10);
    });
    console.log('  product link samples:');
    for (const l of productLinks) console.log('   ', l);
  } catch (err) {
    console.log('  category failed:', (err as Error).message);
  }

  await page.close();
  await closeBrowser();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
