# Content + SEO Strategy

The win condition we agreed on: **rank top-3 on Google for `[brand] [part-number]` exact-match queries** across as many SKUs as we can. Long-tail moat. Head terms come later, only after Phase-1 traffic earns us backlinks.

This document is the strategy contract. Schema, workflows, and success metrics. Code comes later, after we agree.

---

## 1. Why we win this fight

Our competitors have ad budget. We can't outbid them on `pump seal replacement` or `hvac controls supplier`. We don't try.

What we have they don't bother with:
- **The full long tail.** A SKU page for `Bell & Gossett 186094LF` competes against maybe 5–10 indexed pages on Google. Top-3 is achievable with technical SEO + decent content. They go for head terms instead.
- **Speed.** Static-generated Next.js pages serve in <200ms globally. Old WordPress catalogs serve in 2–4s. Page speed is a confirmed ranking signal and conversion driver.
- **Structured data done right.** Most distributors don't emit clean `Product` JSON-LD with offers, ratings, breadcrumbs. We will, on every page.
- **Internal linking density.** A canonical part-number page links to: brand page, model page, cross-references (other equivalent parts), and 3–5 related parts. They link to "category > brand" only.
- **Content depth at scale.** Claude drafts 500–2,000 articles in days. They hand-write 20 a year.

The realistic ceiling at 10,000 ranked SKUs at top-3 average:
```
10,000 pages × 50 monthly searches × 35% CTR × 1% conversion × $50 AOV = ~$87K/mo gross
```

Hitting half of that in year 1 is the bar.

---

## 2. The four page types that matter

Every URL on the site is one of these:

| Page type | URL pattern | What ranks for | Volume | Content depth |
|---|---|---|---|---|
| **SKU page** | `/p/[brand-slug]/[part-number]` | `[brand] [part-number]` | 30K-50K pages | 200-400 words + structured data |
| **Model page** | `/m/[brand-slug]/[model-slug]` | `[brand] [model] parts`, `[model] replacement` | 500-2K pages | 800-1500 words + parts list |
| **Brand page** | `/b/[brand-slug]` | `[brand] parts`, `[brand] catalog` | 200-500 pages | 1500-3000 words + categories grid |
| **Topical article** | `/blog/[slug]` | how-to / troubleshooting / compatibility | 100-500 articles | 1500-3000 words |

SKU pages are the volume play. Model + Brand + Topical are the **internal-linking authority** that pushes the SKU pages up the rankings.

---

## 3. Schema additions

These tables stack on top of what's already in `INFRA_AND_MIGRATIONS.md`.

### `models` (first-class entity)

```sql
CREATE TABLE models (
  id              BIGSERIAL PRIMARY KEY,
  brand_id        BIGINT NOT NULL REFERENCES brands(id),
  name            TEXT NOT NULL,                          -- "Series 80", "3196 MT", "LMB24-3"
  slug            TEXT NOT NULL,                          -- "series-80"
  description     TEXT,
  release_year    SMALLINT,
  predecessor_id  BIGINT REFERENCES models(id),
  successor_id    BIGINT REFERENCES models(id),
  status          TEXT NOT NULL DEFAULT 'current',        -- 'current' | 'legacy' | 'discontinued'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, slug)
);
CREATE INDEX idx_models_brand ON models(brand_id);
CREATE INDEX idx_models_slug  ON models(slug);
```

Plus a join to products:

```sql
ALTER TABLE products ADD COLUMN model_id BIGINT REFERENCES models(id);
CREATE INDEX idx_products_model ON products(model_id);
```

Why models matter: discontinued pump models (B&G Series 60, Goulds 3196 i-FRAME predecessor) have 30-year installed bases. People search "[discontinued model] replacement" all day. Each model page lists every SKU we have for it — captures both informational and transactional intent.

### `articles` (single table, discriminator)

```sql
CREATE TABLE articles (
  id                  BIGSERIAL PRIMARY KEY,
  target_type         TEXT NOT NULL,                       -- 'brand' | 'model' | 'product' | 'category' | 'topical'
  target_id           BIGINT,                              -- FK to brands/models/products/categories; NULL for topical
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  meta_description    TEXT,
  h1                  TEXT,                                -- can differ from title for SEO
  body_markdown       TEXT NOT NULL,                       -- source of truth
  body_html           TEXT,                                -- rendered, cached
  word_count          INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft',       -- 'draft' | 'review' | 'published' | 'archived'
  author              TEXT,                                -- 'claude' | 'human' | 'claude+human'
  published_at        TIMESTAMPTZ,
  last_indexed_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_articles_target  ON articles(target_type, target_id);
CREATE INDEX idx_articles_status  ON articles(status);
CREATE INDEX idx_articles_slug    ON articles(slug);
```

Notes:
- `target_id` is intentionally polymorphic — no FK constraint at DB level. Application layer ensures referential integrity. Lets one table cover all article shapes without table-per-type sprawl.
- `body_markdown` is the source of truth; `body_html` is the rendered cache. If we regenerate the renderer, we re-render from markdown.
- `author = 'claude'` for first drafts; flips to `'claude+human'` after your review touches it.

### `keywords` (single table, discriminator)

```sql
CREATE TABLE keywords (
  id                      BIGSERIAL PRIMARY KEY,
  target_type             TEXT NOT NULL,                   -- 'product' | 'article'
  target_id               BIGINT NOT NULL,
  query                   TEXT NOT NULL,
  query_normalized        TEXT NOT NULL,                   -- lowercase, no punctuation
  intent                  TEXT,                            -- 'transactional' | 'informational' | 'commercial' | 'navigational'
  source                  TEXT NOT NULL,                   -- 'google-autocomplete' | 'google-related' | 'serp-scrape' | 'manual'
  monthly_search_volume   INTEGER,                         -- nullable until we estimate
  serp_competitor_count   SMALLINT,                        -- rough difficulty signal
  collected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_type, target_id, query_normalized)
);
CREATE INDEX idx_keywords_target ON keywords(target_type, target_id);
CREATE INDEX idx_keywords_volume ON keywords(monthly_search_volume DESC);
```

One product → many keywords. We score the product by aggregating its keyword volumes (Section 5).

### `product_scores` (computed nightly)

```sql
CREATE TABLE product_scores (
  product_id              BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  popularity_score        INTEGER NOT NULL DEFAULT 0,      -- 0-100
  search_intent_score     INTEGER NOT NULL DEFAULT 0,      -- 0-100, weighted by intent type
  data_quality_score      INTEGER NOT NULL DEFAULT 0,      -- 0-100, from curation pipeline
  composite_score         INTEGER NOT NULL DEFAULT 0,      -- weighted sum, 0-100
  priority_tier           SMALLINT NOT NULL DEFAULT 4,     -- 1 = top priority for content, 4 = lowest
  calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scores_composite ON product_scores(composite_score DESC);
CREATE INDEX idx_scores_tier      ON product_scores(priority_tier);
```

Refreshed via batch job nightly. Drives content generation order — we draft articles for tier-1 products first.

---

## 4. Free Google keyword acquisition

No paid APIs. We extract popularity signals from Google's own free surfaces:

### Source A — Autocomplete suggestions

For each SKU, query Google autocomplete (`suggestqueries.google.com/complete/search?client=firefox&q=...`):

- `bell gossett 186094lf` → returns related completions
- `bell gossett 186094lf seal kit` → more completions
- `bell gossett 186094` (truncated) → reveals what users actually search

Each returned suggestion is a real query someone typed. We capture them all per SKU, dedupe, store in `keywords`.

**Rate-limited.** Google blocks aggressive automation. Pacing: 1 query/3 seconds, rotate user-agents, run during off-hours. For 50K SKUs × 3 prefixes each = 150K queries → ~5 days at 1/3s. Manageable.

### Source B — SERP scrape (top-10 results)

For each SKU's canonical query, scrape Google's top-10 results pages:

- Count of competing pages → difficulty signal
- Domain authority of competitors (rough proxy: how many distinct domains in top-10)
- Whether there's a "People Also Ask" box → informational intent signal
- Whether ads run on the SERP → commercial intent signal

This is also rate-limited. Stealth Puppeteer (we already have it from the Walmart scanner). 1 SERP/5–10 seconds. 50K SKUs = 5–7 days of background scraping.

### Source C — Google Trends (free, less granular)

For brand-level and category-level trending data. Doesn't give per-SKU volume but signals which brands/categories are gaining mindshare.

### Source D — Related Searches block

At the bottom of any SERP, Google shows 8 "Related searches." These are gold for content discovery:

- "bell gossett 186094lf installation"
- "bell gossett 186094lf vs 189141"
- "bell gossett 186094lf cross reference"

Each becomes a candidate article topic. We capture these in `keywords` with `target_type = 'product'` and `source = 'google-related'`.

### Volume estimation (no paid API)

We don't get exact "1,200 monthly searches" numbers from Google free. We estimate volume bands instead:

- **High** (>500/mo): query appears in autocomplete after typing 3 chars, has Related Searches block, 5+ competitors in top-10
- **Medium** (50–500/mo): autocomplete after 5 chars, some related searches, 2–5 competitors
- **Low** (<50/mo): only appears in autocomplete with full query, no related searches, 0–2 competitors

Stored as `monthly_search_volume` rounded to band midpoint (25, 250, 750). Good enough for prioritization — we don't need the precision Ahrefs gives, we need the ORDER.

When we eventually pay for keyword data, we backfill the precise numbers — schema doesn't change.

---

## 5. Scoring algorithm

`product_scores.composite_score` = weighted sum, rebuilt nightly:

```
popularity_score (40% weight):
  - log(sum of keyword monthly_search_volume) * 20  (cap at 40)

search_intent_score (30% weight):
  - count of transactional keywords for this product * 5  (cap at 30)
  - "transactional" = query contains "buy", "price", "replacement", "kit", part number alone

data_quality_score (30% weight):
  - already computed in curation pipeline (Section 5 of BACKEND_PLAN.md)
  - cap at 30

composite_score = popularity * 0.4 + intent * 0.3 + quality * 0.3
priority_tier:
  composite >= 75: tier 1  (top ~10%)
  composite >= 50: tier 2  (next ~20%)
  composite >= 30: tier 3  (next ~30%)
  composite <  30: tier 4  (bottom ~40%)
```

**What this drives:**
- Tier 1 SKUs get individual blog content (1,000+ words each, hand-reviewed)
- Tier 2 SKUs get article templates filled in by Claude (500 words, lighter review)
- Tier 3 SKUs get the standard product-page description only (200 words)
- Tier 4 SKUs ship with auto-generated descriptions, no blog

Content effort goes where ROI is highest. At 50K SKUs, this means ~5K tier-1 pages get serious investment, ~10K tier-2 get template content, the rest run on auto-pilot.

---

## 6. Content drafting workflow

You said: Claude drafts, you review. Concrete pipeline:

```
nightly job:
  for product in tier_1_products without published article:
    1. Pull product data + top 10 keywords + top 5 cross-references
    2. Call Claude with structured prompt → markdown draft
    3. Insert into articles (status='review', author='claude')
    4. Notify you (email digest of new drafts to review)

your workflow:
  /admin/articles?status=review
  → side-by-side preview + edit
  → button: 'approve & publish' (sets status='published', published_at=now)
  → or: 'request rewrite' (goes back to draft with your notes)
```

Prompt template for SKU article (sketch):

```
You're writing a product page for: [BRAND] [PART_NUMBER] [MODEL_OPTIONAL].
This is a [CATEGORY] part used in [TYPICAL_APPLICATION].

Cross-references: [LIST]
Specs available: [LIST]

Write 600 words covering:
1. What it is (50 words, plain language)
2. What it fits / replaces (150 words, includes cross-references)
3. Specs and dimensions (150 words, structured)
4. Installation notes (100 words, general guidance not a manual)
5. Common questions buyers ask (150 words, FAQ format)

Tone: industrial buyer's expert. No marketing fluff. Include the part number
exactly 8-12 times naturally. Include cross-reference part numbers verbatim.
Output as markdown with H2 sections.
```

Same template scaled down for tier-2 (300 words, 4 sections), scaled up for tier-1 (1,200 words with installation walkthrough).

For brand and model pages, separate templates with more emphasis on category navigation and product grids.

---

## 7. Internal linking strategy

The single biggest SEO lever we have. Implementation:

**SKU page links out to:**
- Its brand (top breadcrumb)
- Its model (second breadcrumb)
- Its category
- Up to 5 cross-references (alternate part numbers for the same product)
- Up to 5 "related parts in same model" (other SKUs that fit the same pump model)
- The relevant blog article(s)

**Model page links out to:**
- Its brand
- Up to 20 SKUs under this model (paginated grid)
- Sibling models (other Series 80 variants, etc.)
- Topical articles about this model

**Brand page links out to:**
- Top 50 SKUs by score
- All models under this brand (alphabetical)
- All categories with this brand's parts
- Topical articles about this brand

**Topical articles link out to:**
- 5–10 contextually relevant SKUs / models / brands

Total internal link density target: every product page has 15–25 inbound links from other pages. Authority cascades from the brand pages (which earn external backlinks) → models → SKUs.

---

## 8. Technical SEO checklist

Every page emits:

- `<title>` 50–60 chars, includes brand + part number + descriptor
- `<meta description>` 140–160 chars
- `<link rel="canonical">` (avoid duplicate-URL issues across query params)
- `<meta name="robots">` content="index,follow" for live pages
- JSON-LD `Product` schema with offers (price, availability, currency, conditions)
- JSON-LD `BreadcrumbList` schema
- JSON-LD `FAQPage` schema when articles have FAQ section
- OpenGraph + Twitter Card meta for social previews
- `<img loading="lazy">` everywhere below the fold
- Next.js `Image` component with WebP + AVIF
- Sitemap.xml + sitemap-products.xml + sitemap-articles.xml + sitemap-brands.xml + sitemap-models.xml
- robots.txt that allows crawling but blocks `/admin`, `/api`, `/_next`
- Google Search Console verified
- Bing Webmaster verified
- Page-speed target: LCP < 2.0s, FID < 100ms, CLS < 0.1 (Core Web Vitals)
- Mobile-first responsive layout (real, not declared)
- HTTPS everywhere, HSTS header

---

## 9. Success metrics (what "winning" means)

Tracked monthly:

| Metric | Month 3 | Month 6 | Month 12 |
|---|---|---|---|
| Indexed pages in GSC | 5,000 | 20,000 | 40,000 |
| Pages ranked top-10 for primary query | 500 | 5,000 | 15,000 |
| **Pages ranked top-3 for primary query** | **100** | **1,500** | **10,000** |
| Organic clicks / month | 500 | 8,000 | 50,000 |
| Conversion rate (visit → order) | TBD | 0.5% | 1.0% |
| Orders / month | TBD | 40 | 500 |
| Avg order value | $50 | $60 | $75 |
| Revenue / month | TBD | $2,400 | $37,500 |

These are the dashboards we actually look at, not the schema we write to.

---

## 10. What I'd want you to push back on

1. **Tier 4 SKUs getting auto-generated descriptions only.** Risk: thin-content penalty if Google catches a wall of similar pages. Mitigation: vary descriptions, set `noindex` on tier-4 until they earn upgrade via traffic.
2. **No paid keyword data.** Means our volume estimates are bands, not numbers. Will we have content prioritization regrets when Ahrefs would have pointed differently? My bet: bands are enough; saved $100/mo for 6 months.
3. **The 10K-top-3-pages goal at month 12.** That's aggressive against any competitor. If we get 3K it's still a real business. If we get <500 by month 6 we have a model problem.
4. **Claude as primary content author.** Risk: AI-detector tools, "site looks AI-generated" reputation. Mitigation: human review touches every tier-1 page; vary section structure; cite specific cross-references and dimensions that AI without our data couldn't fabricate.

---

## 11. What's next

This doc establishes the schema and strategy. The actual build sequence:

1. You spin up the `nurtique` repo on GitHub
2. Decide on the monorepo skeleton (pnpm-workspace.yaml, apps/, packages/, db/, infra/)
3. Postgres + dbmate set up — first migration covers everything from `INFRA_AND_MIGRATIONS.md` + this doc's tables
4. Import 316K staging rows from current Excel into `staging_raw_skus`
5. Curate → ~50K products
6. Keyword-scraping agent (Google autocomplete + SERP + related searches)
7. Score products → `product_scores` populated
8. Claude content-drafting pipeline for tier-1 products
9. Express API + Next.js storefront with first 1,000 SKU pages live

That's a 4–6 week buildout to a live site with thousands of indexed SKU pages. Backlinks and ranking come after — months 3–6 of organic indexing.

Sound right? Push back on anything before we touch a keyboard.
