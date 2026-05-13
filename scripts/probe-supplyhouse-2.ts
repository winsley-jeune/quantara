// Enumerate SupplyHouse product sitemaps + sample URL patterns.
import { getBrowser, closeBrowser } from '../src/utils/puppeteer';

async function main(): Promise<void> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  );

  // Fetch sitemap index
  await page.goto('https://www.supplyhouse.com/sitemap.xml', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const indexXml = await page.evaluate(() => document.body.innerText);
  const sitemapUrls = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  console.log('child sitemaps:', sitemapUrls.length);
  for (const u of sitemapUrls) console.log(' ', u);

  // Fetch the first product sitemap and count URLs + sample
  const prodSitemap = sitemapUrls.find((u) => u.includes('products')) ?? sitemapUrls[0];
  if (prodSitemap) {
    console.log(`\nfetching ${prodSitemap}`);
    await page.goto(prodSitemap, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const xml = await page.evaluate(() => document.body.innerText);
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    console.log('URL count:', urls.length);
    console.log('first 8:');
    for (const u of urls.slice(0, 8)) console.log(' ', u);
  }

  await page.close();
  await closeBrowser();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
