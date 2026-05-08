// Test whether a plain HTTP fetch returns the Walmart PDP with __NEXT_DATA__
// intact. If yes, we can skip Puppeteer entirely for the PDP enrichment stage,
// which is much faster and avoids headless-browser fingerprinting.

const URL_PATH = process.argv[2] ?? '/ip/Post-OREO-PUFFS-Breakfast-Cereal-Crunchy-16-5-oz-Box/11044223584';
const headers = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  Connection: 'keep-alive',
};

async function main(): Promise<void> {
  const url = `https://www.walmart.com${URL_PATH}`;
  console.log('GET', url);
  const resp = await fetch(url, { headers });
  console.log('status:', resp.status);
  const html = await resp.text();
  console.log('html length:', html.length);
  console.log('first 200 chars:', html.slice(0, 200));

  const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nextMatch) {
    console.log('no __NEXT_DATA__ in response');
    return;
  }
  const json = JSON.parse(nextMatch[1] as string);
  const seen = new WeakSet<object>();
  let upc: string | null = null;
  let gtin: string | null = null;
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    const o = node as Record<string, unknown>;
    if (!upc && typeof o.upc === 'string') upc = o.upc;
    if (!gtin && typeof o.gtin13 === 'string') gtin = o.gtin13;
    if (upc && gtin) return;
    for (const k of Object.keys(o)) walk(o[k]);
  }
  walk(json);
  console.log('upc:', upc);
  console.log('gtin:', gtin);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
