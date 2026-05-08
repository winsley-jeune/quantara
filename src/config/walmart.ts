export const WALMART_FEED_URLS: string[] = [
  'https://www.walmart.com/search?q=cereal',
];

export const WALMART_CONFIG = {
  pageRenderTimeoutMs: 60_000,
  pdpConcurrency: 4,
  maxItemsPerFeed: 60,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 900 },
};
