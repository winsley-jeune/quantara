# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Node 18+; Puppeteer downloads Chromium on install
npm start            # production server (server.js)
npm run dev          # node --watch (auto-restart, Node 22+)

# Legacy McMaster-only scrapers (share no code with src/):
npm run scrape:catalog   # CATEGORY_URL=... required
npm run scrape:tiles
npm run scrape:skus
```

No test suite, no linter, no build step. The UI in `public/index.html` is hand-written HTML/JS served directly — there is nothing to compile.

`.env` needs `ANTHROPIC_API_KEY`; `PORT` (default 3000) and `QUANTARA_DB` (default `data/quantara.db`) are optional. The server boots without the key but `/api/extract*`, `/api/group`, and `/api/find-competitors` will return typed 5xx until it's set.

## Architecture

Three strictly-separated layers. Routes never call SDKs. Extractors/analysis/discovery never produce HTTP responses. Output never calls Claude or Puppeteer.

```
routes/        validate input, translate ExtractError → typed JSON
extractor/     URL or PDF → Product           (Puppeteer + Claude)
analysis/      Product[] → groupings          (Claude)
discovery/     Product → competitor candidates (Claude + web_search tool)
output/        Product[] → .xlsx              (no SDK calls)
```

To add an ingestion path: new file in `src/extractor/` + one route. To add an analysis: new file in `src/analysis/` + one route. Existing files don't change.

### The Product object

Canonical shape passed between every layer. Fields documented in README §"Data model". A few invariants worth knowing before editing:

- **Underscore-prefixed fields (`_history`, `_economics`, `_group`, `_competitors`, …) are local annotations.** They drive UI badges and optional workbook columns. They must never be sent to Claude — strip them at any boundary that calls the SDK.
- `extractionMode` is set by the orchestrator, not by the route. Values: `text`, `vision`, `hybrid`, `text-low-confidence`, `pdf-text`.
- `sourceUrl` is the post-redirect URL for web extracts and `pdf:<filename>` for PDF extracts. PDF-sourced products are **not** persisted to SQLite (no canonical re-fetch URL).

### URL extraction orchestrator (`src/extractor/extractFromUrl.js`)

Single source of strategy. Pipeline: `renderPage` (stealth Puppeteer) → `detectBlock` (hard blocks throw `ExtractError` with typed `code`) → `cleanHtml` → `htmlToMarkdown` (60K-char cap) → `extractFromText` (Claude tool_use). If the text result is thin (no title, or no description/specs/price), falls back to `extractFromImage` on the rendered viewport screenshot. Hybrid mode merges fields from both.

`ExtractError` carries `{message, status, code}`. Routes use `errorPayload(err)` in `src/routes/extract.js` to translate. Codes are documented in README §"HTTP API"; if you add a new failure mode, add a code there too.

### Anthropic conventions

- Model is centralized in `src/utils/anthropic.js` (`MODEL` constant). Change it once; both extraction and analysis pick it up.
- Every Claude call uses `cache_control: { type: 'ephemeral' }` on **the system prompt and the tool definition**. The cache key is byte-exact: any change to the cached prefix invalidates the 5-minute TTL. When editing prompts/tools, keep the cached prefix stable across calls or expect `cache_read_input_tokens=0` in logs.
- Tool use is forced single-tool (`tool_choice: {type: 'tool', name: '<name>'}`). The schemas (`record_product`, `record_products`, `record_groups`, …) live in `src/extractor/productSchema.js` and are the single source of truth — don't redefine them inline.
- `logUsage(label, usage)` from `src/utils/anthropic.js` is how we surface token/cache stats. Use it for every new SDK call.

### Discovery layer (`src/discovery/`)

Newer subsystem (not in README). `discoverCompetitors(product)` is a 4-stage orchestrator: `planSearchStrategy` (Claude designs queries across strata) → `runSearchPasses` (parallel Claude calls with the server-side `web_search` tool) → `filterCandidateUrls` (pure URL hygiene; product-page patterns; dedupe by hostname; exclude source domain) → `categorizeUrl` (hostname → retailer/tier/trust via `retailerTaxonomy.json`). Returns `{candidates, plan, coverage}`. The first call to find a URL "wins" its stratum/query attribution.

### Persistence (`src/db/`)

`better-sqlite3`, WAL mode, lazy connection, idempotent schema in `database.js`. One table (`extractions`); see README §"Database schema".

In `routes/extract.js`, the order is load-bearing: read the previous snapshot **before** running extraction, then write the new snapshot **after**. Otherwise the delta would compare against itself. Persistence is wrapped in `safeCall` — snapshot failures must never fail the user's extraction.

### Workbook output (`src/output/toExcel.js`)

Multi-product workbook keyed by `Ref` (SKU when present, else title). The Variants sheet and the optional Products columns (price-history, economics, group) only appear when at least one product carries the corresponding data — don't widen the sheet for users who don't use the feature.

## Things to know before editing

- **Constants live next to behavior, not in env.** Timeouts, char caps, concurrency limits, etc. are top-of-file constants in their owning module (see README §"Configuration" table). Change them in code.
- **Stealth has limits.** `puppeteer-extra-plugin-stealth` defeats Cloudflare "Just a moment" and basic fingerprinting. It does not defeat hCaptcha, hardened Amazon, or geo-gates. When stealth fails, `blockDetect` is what surfaces a clean typed error instead of garbage extraction — keep its detection rules in sync if you add new blocked-page shapes.
- **PDF v1 is text-only.** Image-only/scanned PDFs return `422 pdf_no_text`. Don't add a silent-success path; OCR would be a separate orchestrator.
- **No auth.** Server is for trusted local/single-user use. Don't add features that assume multi-tenant isolation without first putting auth in front.
- **Legacy directory is frozen.** `legacy/` preserves McMaster-specific scrapers from before the Claude-powered architecture. They share no code with `src/` and exist for bulk runs against that one supplier. Don't refactor them into `src/`.
