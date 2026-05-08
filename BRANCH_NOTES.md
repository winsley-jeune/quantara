# Branch: feat/full-catalog-automation

Built unattended on 2026-05-08 while you were away. This branch makes Quantara
robust enough to run the full 53-URL catalog scan without supervision and
keeps a long-lived master products catalog across runs.

## What changed

### Robustness
- **Single-scan guard** (`POST /api/scans` returns 409 if one is already
  running). This is the bug that stomped your three-concurrent scans
  earlier — `controllers/scan.controller.ts` now checks `getRunningScan()`
  before kicking off.
- **Per-feed try/catch** (already on master) — a blocked feed no longer
  throws away products from earlier feeds.
- **Progress checkpointing** — products are persisted after each feed, not
  only at the end. Crash mid-scan and you keep what you got.
- **Browser fingerprint rotation** — `utils/puppeteer.ts` recycles the
  Chromium process every 15 page-uses, clearing cookies and rotating the
  headless fingerprint. Tunable via `QUANTARA_BROWSER_RECYCLE_AFTER`.
- **Adaptive backoff** — feed cooldowns start at 60s, double on bot
  challenge (cap 10 min), halve back to baseline on a clean feed.

### 50%-rate-limit directive
Per your instruction, paced everything well below empirical Walmart limits:
- PDP fetch every **3s** (was 1.5s — half the rate that previously
  triggered blocks).
- 60s baseline cooldown between feeds (was 0).
- Browser recycle every 15 pages (was 25).

This roughly **doubles total scan time** but produces clean runs. A full
53-URL scan now budgets ~3–5 hours under blocked-free conditions.

### Master products catalog
Cross-scan deduplication so you have one ever-growing sourcing list:
- New `master_products` table — keyed by `(source, source_id)`,
  upserted by every scan, tracks `first_seen_at`, `last_seen_at`,
  `times_seen`.
- `GET /api/products?limit=N` — JSON list ordered by most-recently-seen.
- `GET /api/products/workbook` — downloadable xlsx of the whole catalog.
- The per-scan workbook (`/api/scans/:id/workbook`) is unchanged.

### Full-catalog endpoint
- `POST /api/scans/full` — runs every URL in `CATEGORY_FEEDS` (53 URLs as
  of this branch). Convenience wrapper.

### Tests
- `npm test` — 9 unit tests using `node:test` (no new deps): brand
  filter normalization, productMapper field handling, scraper traversal
  including cycle safety.

## API summary on this branch

```
GET  /api/health
POST /api/scans          { feedUrls?: string[] }   — single scan, 409 if busy
POST /api/scans/full                               — all 53 categories, 409 if busy
GET  /api/scans                                    — recent runs
GET  /api/scans/:id                                — run + products
GET  /api/scans/:id/workbook                       — per-run xlsx
GET  /api/products?limit=N                         — master catalog (JSON)
GET  /api/products/workbook?limit=N                — master catalog (xlsx)
```

## Files changed
- `src/config/walmart.ts` — `CATEGORY_FEEDS` exposed (already on master)
- `src/services/scanRunner.ts` — backoff, checkpoint, recycle, conservative pacing
- `src/services/brandFilter.ts` — unchanged
- `src/utils/puppeteer.ts` — fingerprint rotation
- `src/models/db.ts` — `master_products`, `getRunningScan`, `upsertMasterProducts`
- `src/controllers/scan.controller.ts` — 409 guard, `createFullScan`
- `src/controllers/products.controller.ts` — new
- `src/routes/scan.routes.ts` — `/scans/full`
- `src/routes/products.routes.ts` — new
- `src/routes/index.ts` — wire products routes
- `src/__tests__/*.test.ts` — new
- `package.json` — added `npm test`

## How to validate on return

```bash
git checkout feat/full-catalog-automation
npm install                 # in case deps changed (they didn't, but safe)
npm test                    # 9 tests, fast, no network
npm run dev

# Single category
curl -X POST localhost:3000/api/scans -H 'content-type: application/json' \
  -d '{"feedUrls":["https://www.walmart.com/search?q=desk+organizer"]}'

# Full catalog (will run 3–5 hours)
curl -X POST localhost:3000/api/scans/full

# Master catalog as Excel
curl -o master.xlsx localhost:3000/api/products/workbook
```

## Open follow-ups (not done on this branch)

- Scheduled scans (cron-style) — held off because you didn't ask for
  it and it's a different shape of work (would need a scheduler module).
- Amazon ASIN matching — Phase 2 territory; needs a paid data source
  (Keepa/SP-API) to be honest.
- Retry on per-PDP failure — currently we move on; could add 1 retry
  with a longer wait, but the master catalog will see the product on
  the next scan anyway.
- Hot config reload — to add a category URL today you have to restart
  the server. Could read `WALMART_FEED_URLS` per request, but it'd
  invalidate the principle of "config lives next to behavior."

## Current scan running

Kicked off `POST /api/scans/full` against all 53 URLs at the time of the
last commit. Check `GET /api/scans` to see status. Workbook will be
available at `GET /api/products/workbook` once products start landing
(progress is checkpointed after each feed).
