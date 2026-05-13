# Backend Plan — Search-First Catalog at Scale

You execute. I plan. This document is the design — Postgres schema, search architecture, API patterns, scale targets.

**The reframe vs. what I just built:**
- Drop SQLite. Postgres for production from day one.
- The 316K rows are **staging**, not production. We curate them down to a smaller, normalized, high-quality table.
- The product is a **search engine**, not a catalog dump. Schema designed for fast lookup, fuzzy match, eventually image search.
- Backend designed for **millions of requests/day** — read-optimized, cacheable, horizontally scalable.

---

## 1. The two-layer split: staging vs. catalog

```
                ┌─────────────────────┐
   scrapers ──► │  staging_raw_skus   │    Postgres or S3 + Parquet
                │  (316K, messy)      │    write-heavy, read-rarely
                └──────────┬──────────┘
                           │ curation pipeline
                           │ (normalize, dedupe, filter quality)
                           ▼
                ┌─────────────────────┐
                │      products       │    Postgres, hot path
                │  (~30-50K, clean)   │    read-heavy, search-optimized
                └─────────────────────┘
                           ▲
                           │
                          API → cache → users
```

**Why split:** the messy 316K scraper output should never touch the production query path. Curation happens offline (batch jobs), output is a clean indexed table the API hits. If a scraper bug pollutes staging, production isn't affected.

---

## 2. Postgres schema (curated layer)

### `brands` (~500 rows expected)
Canonical brand list. Multiple aliases collapse to one ID.

```sql
CREATE TABLE brands (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,                          -- "Bell & Gossett"
  slug            TEXT NOT NULL UNIQUE,                   -- "bell-gossett"
  parent_company  TEXT,                                   -- "Xylem"
  website         TEXT,
  brand_type      TEXT NOT NULL,                          -- 'oem' | 'aftermarket'
  authorized_for_resale  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_type ON brands(brand_type);
```

### `brand_aliases` (~2K rows)
Every textual variant maps to a canonical brand. Used at ingestion + at search-query parse time.

```sql
CREATE TABLE brand_aliases (
  id          BIGSERIAL PRIMARY KEY,
  brand_id    BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  alias       TEXT NOT NULL,                              -- "B and G", "bell-gossett", "B&G"
  alias_norm  TEXT NOT NULL,                              -- "bandg", "bellgossett", "bg"
  UNIQUE (alias_norm)
);

CREATE INDEX idx_brand_aliases_norm ON brand_aliases(alias_norm);
```

### `categories` (hierarchical, ~100 rows)
Two-level: `hvac-controls > damper-actuators`, `pump-seal > cartridge`, etc.

```sql
CREATE TABLE categories (
  id           BIGSERIAL PRIMARY KEY,
  parent_id    BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  display_order INTEGER DEFAULT 0
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
```

### `products` (the hot table, ~30-50K rows after curation)

```sql
CREATE TABLE products (
  id                    BIGSERIAL PRIMARY KEY,
  brand_id              BIGINT NOT NULL REFERENCES brands(id),
  category_id           BIGINT REFERENCES categories(id),

  part_number           TEXT NOT NULL,                    -- "186094LF" (display)
  part_number_norm      TEXT NOT NULL,                    -- "186094lf" (search)
  model                 TEXT,                             -- "Series 80" / "1531"
  model_norm            TEXT,

  title                 TEXT NOT NULL,                    -- generated, SEO-friendly
  description           TEXT,
  short_summary         TEXT,                             -- 1-line for autocomplete

  primary_image_url     TEXT,
  thumbnail_url         TEXT,

  status                TEXT NOT NULL DEFAULT 'sourced',  -- sourced|verified|live|delisted
  is_buyable            BOOLEAN DEFAULT FALSE,            -- only true when pricing exists
  data_quality_score    SMALLINT DEFAULT 0,               -- 0-100, used to rank in search

  -- Search optimization columns
  search_vector         TSVECTOR,                         -- updated by trigger
  -- Trigram index built on (part_number_norm, model_norm, title) below

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_seen_at         TIMESTAMPTZ,
  last_verified_at      TIMESTAMPTZ,

  UNIQUE (brand_id, part_number_norm)
);

-- Search indexes — the whole reason this table exists
CREATE INDEX idx_products_search_vec   ON products USING GIN (search_vector);
CREATE INDEX idx_products_part_trgm    ON products USING GIN (part_number_norm gin_trgm_ops);
CREATE INDEX idx_products_title_trgm   ON products USING GIN (title gin_trgm_ops);
CREATE INDEX idx_products_brand        ON products(brand_id);
CREATE INDEX idx_products_category     ON products(category_id);
CREATE INDEX idx_products_status_buy   ON products(status, is_buyable) WHERE is_buyable = TRUE;
CREATE INDEX idx_products_quality      ON products(data_quality_score DESC);

-- Auto-maintain search_vector
CREATE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.part_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.model, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_search_vector
  BEFORE INSERT OR UPDATE OF part_number, model, title, description ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
```

### `part_number_aliases` (cross-references)
Every alternate part number for a product. Vulcan Type-10 == B&G 186094LF == JC Type 21.

```sql
CREATE TABLE part_number_aliases (
  id                BIGSERIAL PRIMARY KEY,
  product_id        BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  brand_id          BIGINT NOT NULL REFERENCES brands(id),     -- whose part number this is
  alias_part_number TEXT NOT NULL,                              -- display
  alias_part_norm   TEXT NOT NULL,                              -- search
  alias_type        TEXT NOT NULL,                              -- 'oem' | 'aftermarket' | 'replacement'
  source            TEXT,                                       -- which scraper saw it
  UNIQUE (product_id, brand_id, alias_part_norm)
);

CREATE INDEX idx_alias_part_norm  ON part_number_aliases(alias_part_norm);
CREATE INDEX idx_alias_trgm       ON part_number_aliases USING GIN (alias_part_norm gin_trgm_ops);
CREATE INDEX idx_alias_product    ON part_number_aliases(product_id);
CREATE INDEX idx_alias_brand      ON part_number_aliases(brand_id);
```

### `product_images` (for visual confirmation flow)

```sql
CREATE TABLE product_images (
  id            BIGSERIAL PRIMARY KEY,
  product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  thumbnail_url TEXT,
  image_type    TEXT,                                     -- 'product', 'diagram', 'label'
  source        TEXT,
  display_order INTEGER DEFAULT 0,
  -- For future image-based search: embedding vector
  -- embedding   VECTOR(512)                              -- pgvector when we get there
);

CREATE INDEX idx_images_product ON product_images(product_id);
```

### `staging_raw_skus` (the 316K dump)

Keep this for source-of-truth. The curation pipeline reads from here, the API never touches it.

```sql
CREATE TABLE staging_raw_skus (
  id                BIGSERIAL PRIMARY KEY,
  source            TEXT NOT NULL,                        -- 'supplyhouse-sitemap', 'us-seal-pdf', etc.
  source_url        TEXT,
  raw_brand         TEXT,
  raw_part_number   TEXT,
  raw_description   TEXT,
  aftermarket_brand TEXT,
  aftermarket_part  TEXT,
  category_hint     TEXT,
  raw_payload       JSONB,                                -- whatever the scraper produced
  scraped_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promoted_to_id    BIGINT REFERENCES products(id),       -- nullable: NULL until curated
  promoted_at       TIMESTAMPTZ,
  rejected_reason   TEXT                                  -- nullable: why curation dropped it
);

CREATE INDEX idx_staging_source       ON staging_raw_skus(source);
CREATE INDEX idx_staging_brand_part   ON staging_raw_skus(raw_brand, raw_part_number);
CREATE INDEX idx_staging_unpromoted   ON staging_raw_skus(promoted_to_id) WHERE promoted_to_id IS NULL;
```

### Manufacturer-outreach tables
Carry over from earlier draft, with `manufacturers`, `outreach_events`, `pricing` largely unchanged but with proper FKs to `brands`. Keeping in this doc only structurally:

```sql
CREATE TABLE manufacturers     ( -- as before, now also brand_id FK )
CREATE TABLE outreach_events   ( -- as before )
CREATE TABLE pricing           ( -- product_id FK, manufacturer_id FK, wholesale/list/retail )
```

---

## 3. Data curation pipeline (staging → products)

A scheduled batch job, runs nightly:

### Step 1 — Filter low-quality rows
Drop rows where:
- `raw_brand` is "GENERIC", a single character, or empty
- `raw_part_number` has <3 alphanumeric chars
- `raw_part_number` matches a noise pattern (pure ASCII art, slug fragments)
- Source is known low-quality (test data, blog posts misidentified as products)

### Step 2 — Brand normalization
For each surviving row, look up `brand_aliases` by `normalize(raw_brand)`. If hit → use canonical brand. If miss → flag for manual review (or auto-create with `brand_type='unknown'`).

### Step 3 — Part number cleanup
- Strip leading/trailing dashes, spaces, dots
- Uppercase
- Validate against per-brand patterns where known (e.g., B&G is usually digits + optional suffix like LF)
- Reject if invalid format

### Step 4 — Cluster duplicates across sources
Group by `(brand_id, part_number_norm)`. One canonical row, all sources attached as `staging_raw_skus.promoted_to_id`.

### Step 5 — Score quality
```
quality_score =
  + 30 if seen in 2+ sources
  + 20 if has aftermarket cross-reference
  + 15 if part number matches known brand pattern
  + 10 if description >20 chars
  + 10 if category resolved
  + 10 if image URL present
  + 5  if model resolved
   = max 100
```

Only rows with `quality_score >= 50` get promoted to `products`. Everything else stays in staging until enriched.

### Step 6 — Generate SEO fields
- `title` = `${brand_name} ${part_number} ${model_or_short_desc}` (truncated to 70 chars)
- `short_summary` = first 120 chars of description, clean
- `slug` for routing = `${brand_slug}-${part_number_norm}`

### Result
Of 316K staging rows, **expected output: 30-50K production products**. The rest stays in staging for later enrichment.

---

## 4. Search architecture

Three search modes, all hitting the same `products` table but different indexes:

### A) Exact / prefix part-number search (the 80% case)
User types "186094LF" or "186094".

```sql
SELECT id, brand_id, part_number, title, primary_image_url
FROM products
WHERE part_number_norm = lower(:q)
   OR part_number_norm LIKE lower(:q) || '%'
ORDER BY data_quality_score DESC
LIMIT 10;
```

Also check `part_number_aliases` for cross-references:

```sql
SELECT p.* FROM products p
JOIN part_number_aliases a ON a.product_id = p.id
WHERE a.alias_part_norm = lower(:q)
   OR a.alias_part_norm LIKE lower(:q) || '%'
LIMIT 20;
```

Index: B-tree on `part_number_norm` + GIN trigram for partial matches.

### B) Fuzzy match (typos / partial / uncertain)
User types "186094" but the real part is "186094LF" — or types "B&G 80" expecting "Bell & Gossett Series 80".

```sql
SELECT id, part_number, title,
       similarity(part_number_norm, lower(:q)) AS sim
FROM products
WHERE part_number_norm % lower(:q)     -- trigram operator
ORDER BY sim DESC
LIMIT 20;
```

Trigram index makes this fast even at 50K rows.

### C) Full-text + context search (broad queries)
User types "Bell and Gossett pump seal kit for series 80".

```sql
SELECT id, ts_rank(search_vector, plainto_tsquery('english', :q)) AS rank
FROM products
WHERE search_vector @@ plainto_tsquery('english', :q)
ORDER BY rank DESC, data_quality_score DESC
LIMIT 20;
```

GIN index on `search_vector`. Returns results across part number, model, title, description.

### D) Image search (Phase 2, post-MVP)
User uploads a photo of a part label.
- **MVP path:** OCR the image (Tesseract or AWS Rekognition or Google Vision), extract text tokens, run text search above with the OCR result as the query.
- **Phase 2:** embed the image (CLIP / similar), nearest-neighbor against pgvector index on `product_images.embedding`. Allows matching products even without legible labels.

---

## 5. API patterns for scale

### Endpoints

```
GET  /api/search?q=...&limit=20&cursor=...    — unified search (modes A/B/C)
GET  /api/products/:slug                       — product detail page
GET  /api/products/:slug/cross-references      — alternate part numbers
GET  /api/brands/:slug                         — brand page
GET  /api/categories/:slug                     — category page
POST /api/search/image                         — upload image, returns candidates
GET  /api/products/:id/related                 — related products in same category/brand
```

### Pagination
**Cursor-based, not offset.** Offset pagination is O(N) on large tables. Cursor:

```
GET /api/search?q=belimo&cursor=eyJpZCI6MTAwLCJyYW5rIjowLjg1fQ==
```

Cursor encodes `(rank, id)` for stable continuation under inserts.

### Response shape
Lean by default, with `?include=` flags for expensive joins:

```json
{
  "results": [
    {
      "id": 12345,
      "brand": "Bell & Gossett",
      "part_number": "186094LF",
      "title": "Bell & Gossett 186094LF Seal Kit Series 80",
      "thumbnail_url": "https://cdn.example.com/thumbs/12345.webp",
      "score": 0.92
    }
  ],
  "next_cursor": "..."
}
```

`?include=images,aliases,pricing` adds joined data when needed.

### Rate limiting
- Anonymous: 60 req/min per IP via Redis-backed counter
- Authenticated: 600 req/min per token
- Search-heavy endpoints separate bucket (10 req/sec/IP) to prevent scraping

---

## 6. Caching strategy

```
┌────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────┐
│ Client │ ─► │ CDN (Vercel)│ ─► │ API edge │ ─► │ Postgres │
└────────┘    └─────────────┘    │  + Redis │    └──────────┘
                                 └──────────┘
```

**Three layers:**

1. **CDN edge cache** — static product pages with long TTL (1 hr). Invalidated on product update via webhook.
2. **Redis** —
   - Search results: cache `(query_string + cursor)` → result list for 5 min
   - Hot products: cache product detail by ID for 1 hr
   - Brand / category pages: cache for 15 min
3. **Postgres** — connection pool (pgbouncer in production), read replicas for search-heavy reads if needed.

**Cache invalidation:** product update bumps a Redis version key for that product's slug + brand + category. Reads check the version key first. Cheap, eventually consistent.

**Hit ratio target:** >90% of search and product-detail traffic served from Redis. Postgres only sees uncached queries + writes.

---

## 7. Scale targets and capacity math

| Metric | Target | Notes |
|---|---|---|
| Total products | 50K curated (300K+ in staging) | Curated grows over time |
| QPS at launch | 100 req/s | One small Postgres instance handles this trivially |
| QPS at 1M req/day | ~12 req/s avg, ~50 peak | Same instance + Redis fronting |
| QPS at 10M req/day | ~120 req/s avg, ~500 peak | Add read replicas + bigger Redis |
| Search latency p95 | <100ms cached, <300ms uncached | GIN + trigram indexes carry this |
| Storage | <5GB for products+aliases+staging | Tiny by Postgres standards |

Postgres on a small managed instance (e.g., Neon, Supabase, RDS db.t3.small) handles this comfortably until you're well past $1M revenue.

---

## 8. Migration path

```
Now:    catalog-stage1.xlsx + scraper code on feat/sku-scraper
        (data in SQLite prototype, will discard)

Step 1: Spin up Postgres (Neon free tier or Supabase free tier — both fine)
Step 2: Run schema migrations
Step 3: Bulk import all 316K rows → staging_raw_skus (COPY FROM, ~30 sec)
Step 4: Run curation pipeline → ~30-50K rows in products
Step 5: Build pg_trgm + tsvector indexes
Step 6: Write the search API on Next.js / your stack
Step 7: Smoke test search latency at 100 QPS via wrk or k6
Step 8: Add Redis layer
Step 9: Launch
```

---

## 9. Open questions for you to decide

1. **Postgres host** — Neon, Supabase, RDS, self-hosted? (Affects connection pooling setup, backup strategy.)
2. **Storage for raw scraper output** — keep in Postgres staging table, or dump to S3 + Parquet for cheaper long-term hold?
3. **Image hosting** — Cloudflare R2, S3, Vercel blob? (Affects CDN config for image-search later.)
4. **Search API stack** — Next.js API routes, or a separate Fastify/Express service? (Latency / cold-start considerations.)
5. **Authentication / accounts** — needed for MVP, or strictly anonymous browsing for now?
6. **Currency / pricing** — single USD, or multi-currency from day one?
7. **Tax / shipping zones** — defer until pricing is live, or design schema now?

---

## What I should DELETE from the SQLite prototype

The recent commits added:
- `src/agent/db/schema.ts` — SQLite schema
- `src/agent/db/products.ts` — SQLite repository
- `src/agent/db/manufacturers.ts` — SQLite repository
- `scripts/ingest-catalog.ts` — SQLite ingestion

These were the wrong abstraction. Once you OK the Postgres design, I (or you) rewrite under `src/db/migrations/` and `src/db/repos/` against Postgres. The scraper modules + the staging concept survive; only the destination changes.

---

## Summary in one paragraph

**Two-layer system: messy `staging_raw_skus` (316K) feeds nightly curation into a clean `products` table (~30-50K) optimized for three search modes (exact, fuzzy, full-text) via Postgres GIN + trigram indexes. API serves results through Redis at >90% hit ratio, with cursor-based pagination, rate limiting, and CDN edge caching. Scales to 10M req/day on a small managed Postgres + Redis without architecture changes. Image-based search lives on the same `products` table via pgvector embeddings in Phase 2.**

Your call on the open questions, then we wire this up against Postgres.
