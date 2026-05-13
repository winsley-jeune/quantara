# Nurtique — Master Plan

**One document. Every decision. Read this first.**

The detailed reference docs (`BACKEND_PLAN.md`, `INFRA_AND_MIGRATIONS.md`, `CONTENT_AND_SEO.md`, etc.) remain as deeper-dive companions. This one is the canonical strategy.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Strategy & positioning](#2-strategy--positioning)
3. [Brand identity](#3-brand-identity)
4. [Product catalog](#4-product-catalog)
5. [Database design](#5-database-design)
6. [Backend architecture](#6-backend-architecture)
7. [Frontend design](#7-frontend-design)
8. [Infrastructure](#8-infrastructure)
9. [SEO & content](#9-seo--content)
10. [Marketing plan](#10-marketing-plan)
11. [Email templates](#11-email-templates)
12. [Social media](#12-social-media)
13. [Operations & fulfillment](#13-operations--fulfillment)
14. [Metrics & success criteria](#14-metrics--success-criteria)
15. [Roadmap](#15-roadmap)
16. [Open decisions](#16-open-decisions)

---

## 1. Executive summary

**What we're building:** Nurtique, a search-first reference + e-commerce site for industrial pump seals and HVAC controls. Two layers stacked: ~50,000 factually-accurate reference pages (every cross-reference, dimension, spec) + 500-2,000 genuinely deep authoritative articles. 100% dropshipping from authorized distributors. No inventory.

**How we win:** Two compounding moats —
1. **Long-tail SEO** on `[brand] [part-number]` exact queries (50K stub pages with citation-grade factual minimums).
2. **AI-citation authority** — become the source that ChatGPT / Perplexity / Gemini cite when a technician or homeowner asks "what seal fits my B&G Series 80?" This is the durable moat: it survives Google algorithm changes.

Competitors have ad budget. We have technical SEO + structured data + original cross-reference data + multi-audience content depth (technicians, homeowners, students).

**Year-1 target:** 5,000-10,000 SKUs ranked top-3 on Google + 200-500 deep articles indexed and cited by at least one AI assistant. → ~$15K-$40K MRR by month 12.

**Capital:** $1K starting + recurring runway (day job / savings) for 12-18 months. **The plan does not work on $1K alone.**

**Team:** You (developer) + me (planning, code support, content drafting tool). **A domain expert (HVAC tech / pump rebuilder) is the critical missing role** — required as content reviewer, contractor, or co-founder. Without expertise, content quality caps below the citation threshold.

---

## 2. Strategy & positioning

### Niche
Aftermarket industrial pump seals (Bell & Gossett, Goulds, Aurora, Taco) + HVAC sensors/controllers (Belimo, Honeywell, ACI). Both have:
- $1B+ US aftermarket
- Online channel still immature (largest pure-play does 1,600 visits/month)
- Search-driven buying behavior (techs Google part numbers at 2am)
- High average order value ($50–$400)

### Competitive moat
| Lever | Competitors | Us |
|---|---|---|
| Ad budget | $$$$ | $0 (initially) |
| Site speed | 2-4s page loads | <500ms (Next.js + CDN) |
| Structured data | Inconsistent | Every page emits clean JSON-LD |
| Long-tail SKU pages | Few hundred | 50,000+ |
| Cross-reference depth | Manufacturer-specific | Unified across brands |
| Content depth | Hand-written, slow | AI-drafted + human-reviewed at scale |

### Win condition
**Rank top-3 on Google for `[brand] [part-number]` queries** across 10,000+ SKUs within 12 months. Head terms come later, only after Phase-1 traffic earns us backlinks.

---

## 3. Brand identity

### Name & domain
- **Name:** Nurtique
- **Domain:** nurtique.com
- **Read:** "nur-teek" — clean, ownable, no negative associations, .com available

### Brand voice
- **Expert, no-fluff.** Like a tradesman who knows the part: confident, technical, specific.
- **Helpful.** We explain compatibility, not just list SKUs.
- **No marketing language.** "Premium." "Best-in-class." Banned.
- **Specific over vague.** "Fits B&G Series 80 frames 1.625"-1.875"" beats "Universal fit."
- **Citation-grade.** Every factual claim should be sourceable. AI assistants cite content that reads like a reference manual, not a sales page.
- **Multi-audience without dumbing down.** Same page speaks to technicians (specs), homeowners (diagnostics), and students (engineering theory) — without watering any of them down.

### Voice examples
| ❌ | ✅ |
|---|---|
| Premium replacement for your pump | Direct OEM-equivalent replacement for B&G 186094LF |
| Industry-leading quality | Manufactured by US Seal Mfg, AS9100-certified |
| Order now! | Ships same-day from regional warehouse |

### Target customer personas
1. **HVAC service tech / commercial plumber.** On-site with a broken pump at 11pm. Knows the part number, just needs it shipped tomorrow.
2. **Facility maintenance manager.** Sourcing for a building portfolio. Bulk-order capability matters.
3. **Pump-rebuild shop owner.** Buys 50-200 seal kits per month. Net-30 terms eventually matter.
4. **Independent contractor / homeowner enthusiast.** Replacing one part. Reads installation guides before buying.

### Brand kit (proposed — push back if you disagree)

**Color palette:**
- **Primary:** `#0A2540` (deep navy — trust, industrial, durable)
- **Accent:** `#FF6B35` (industrial orange — visibility, energy, "in stock" badge)
- **Neutral:** `#1A1F2E` (near-black, body text), `#6B7280` (gray, supporting text), `#F3F4F6` (background), `#FFFFFF` (cards)
- **Functional:** `#10B981` (in-stock green), `#EF4444` (out-of-stock red), `#F59E0B` (low-stock amber)

**Typography:**
- **Headings:** Inter (free, Google Fonts) — technical, legible, modern sans-serif
- **Body:** Inter, 16px base, 1.6 line-height
- **Part numbers / SKU codes:** IBM Plex Mono — distinctive, copyable, scannable

**Logo direction:**
- Wordmark with stylized "N" — clean geometric, no flourishes
- Monogram version for favicon and social avatars
- Black + white versions for print/email
- I'd contract a designer for ~$200-500 once you're ready; not worth my time to mock up in ASCII.

**Imagery style:**
- Real product photos on white seamless background
- Technical diagrams (cross-section drawings preferred over glamour shots)
- No stock photography of "happy workers"
- WebP + AVIF, lazy-loaded, 3 sizes per product (thumb/medium/large)

---

## 4. Product catalog

### Current state
- 316,957 unique SKUs scraped from 7 sources into staging
- Sources: SupplyHouse (310K), PEXUniverse (5K), U.S. Seal PDF (3.8K), Jackson Systems, InlineSales, Vulcan Seals, BoilerSupplies
- Excel exists at `data/catalog-stage1.xlsx` (will become CSV import to Postgres)

### Curation pipeline (6 steps, drops ~85% as low-quality)
1. **Filter:** drop generic/test/noise SKUs, sub-3-char part numbers
2. **Brand normalize:** map textual variants to canonical brand via `brand_aliases`
3. **Part cleanup:** strip whitespace, uppercase, validate format
4. **Cluster:** group by (brand, part_number_norm), one canonical row
5. **Score quality:** 0-100 based on source count, has cross-ref, valid pattern, etc.
6. **Promote:** rows with `quality_score ≥ 50` enter `products`; rest stay in staging

**Expected output:** ~30,000-50,000 curated products.

### Categories (top-level hierarchy)
- Pump seals
  - Cartridge seals
  - Component seals
  - Seal kits
  - O-rings & gaskets
- Pump parts
  - Bearings
  - Bearing isolators
  - Couplings
- HVAC controls
  - Damper actuators
  - Sensors (temperature, humidity, pressure, CO₂)
  - Controllers
  - Relays & transducers
- HVAC parts
  - Motors
  - Capacitors
  - Contactors

### Top brands at launch (~50 canonical)
Bell & Gossett, Goulds, Taco, Grundfos, Armstrong, Aurora, Viking, Flowserve, Worthington, Ingersoll-Dresser, Gorman-Rupp, Crane, Pacific Pumping, Peerless, Cornell, Hoyt, ITT, Marlow, Sterling Fluid, U.S. Seal, Vulcan Seals, AST Seals, PPC, SEPCO, Flexaseal, John Crane, Chesterton, EagleBurgmann, Belimo, Honeywell, Johnson Controls, Siemens, Schneider Electric, Setra, Veris, ACI, BAPI, Greystone, KMC Controls, Functional Devices, Mamac Systems, Dwyer, Carrier, Trane, York, Lennox, Rheem, Hobart, Hoffman, Wessels.

---

## 5. Database design

### Tables (Postgres 16+)

**Catalog layer:**
- `brands` — canonical brand list (~500 rows)
- `brand_aliases` — textual variants → brand_id (~2K rows)
- `categories` — hierarchical, parent_id self-ref (~100 rows)
- `models` — `[Bell & Gossett] [Series 80]`, first-class for SEO (~500-2K rows)
- `products` — the hot table, ~30-50K rows curated from staging
- `part_number_aliases` — cross-references between OEMs/aftermarkets (~50K rows)
- `product_images` — S3 keys + dimensions per image (~150-300K rows at 3 sizes × 50K products)

**Staging layer:**
- `staging_raw_skus` — 316K messy rows from scrapers; promoted_to_id when curated

**Commerce layer:**
- `orders` — pending|paid|fulfilled|shipped|delivered
- `order_items` — line items with `product_snapshot` JSONB
- `tax_rates` — state_code, rate, effective_from
- `tax_nexus` — states we have tax obligation in

**Fulfillment layer (dropship):**
- `distributors` — authorized fulfillment partners (Vulcan, US Seal, HVAC USA…)
- `product_fulfillment` — which distributor(s) ship which SKU + price + lead time
- `shipments` — one per (order, distributor); carrier + tracking
- `shipment_items` — order_items mapped to shipment

**Manufacturer outreach (for Phase-2 authorized pricing):**
- `manufacturers` — outreach pipeline (Vulcan, US Seal direct)
- `outreach_events` — email/form/phone touches + responses
- `pricing` — wholesale/list/retail per product per manufacturer

**Content & SEO:**
- `articles` — single table, `target_type` discriminator (brand|model|product|category|topical)
- `keywords` — per-product or per-article search queries with volume bands
- `product_scores` — popularity + intent + quality, computed nightly

**Extensions required:**
- `citext` (case-insensitive emails)
- `pg_trgm` (fuzzy part-number search)
- `unaccent` (search query normalization)

### Search indexes (the reason this is Postgres not Mongo)
```sql
CREATE INDEX ON products USING GIN (search_vector);                              -- full-text
CREATE INDEX ON products USING GIN (part_number_norm gin_trgm_ops);              -- fuzzy
CREATE INDEX ON products USING GIN (title gin_trgm_ops);                         -- fuzzy
CREATE INDEX ON products(brand_id, status) WHERE is_buyable = TRUE;              -- hot path
CREATE INDEX ON part_number_aliases USING GIN (alias_part_norm gin_trgm_ops);    -- cross-ref search
```

Auto-maintained `tsvector` via trigger on insert/update of (part_number, model, title, description).

---

## 6. Backend architecture

### Stack
- **Runtime:** Node 20 LTS
- **Framework:** Express 4 (REST)
- **DB client:** Kysely (typed query builder, no ORM bloat)
- **Validation:** Zod at every route boundary
- **Cache:** Redis (ioredis)
- **Logging:** Pino (structured JSON)
- **Migrations:** dbmate (raw SQL files)
- **Container:** Docker

### Connection pooling
- pgbouncer in transaction mode between Express and Postgres
- `pool_mode = transaction`, `default_pool_size = 25`, `max_client_conn = 1000`

### API surface
```
GET  /api/search?q=...&limit=20&cursor=...    Unified search (exact + fuzzy + full-text)
GET  /api/search/by-image                      Image-based search (Phase 2: OCR → text query)
GET  /api/products/:slug                       Product detail
GET  /api/products/:slug/cross-references      Alternate part numbers
GET  /api/products/:slug/related               Same model / same category
GET  /api/brands/:slug                         Brand page + top products
GET  /api/models/:slug                         Model page + parts list
GET  /api/categories/:slug                     Category tree + featured products
POST /api/checkout                             Stripe Checkout session
POST /api/webhooks/stripe                      Stripe events
POST /api/webhooks/easypost                    Shipment tracking
GET  /api/admin/articles?status=review         Admin (bearer token)
POST /api/admin/products/:id/images            Image upload (bearer token)
```

### Search modes
1. **Exact / prefix** — `part_number_norm = lower(q)` or `LIKE q%`
2. **Fuzzy** — `part_number_norm % lower(q)` using pg_trgm similarity
3. **Full-text** — `search_vector @@ plainto_tsquery('english', q)`

Routes try (1) first, fall back to (2), fall back to (3). Results merged with rank weighting.

### Rate limiting (Redis-backed sliding window)
- `/api/search` — 30 req/min/IP
- `/api/products/:slug` — 120 req/min/IP
- `/api/checkout` — 10 req/min/IP
- `/api/admin/*` — bearer-token required, separate bucket

### Caching strategy
1. **CDN edge** (CloudFront) — product/brand/model pages, 1-hour TTL
2. **Redis** — search query results 5-min TTL, product details 1-hour TTL
3. **Postgres** — only sees uncached queries + writes

Hit ratio target: **>90% of traffic served from Redis**.

---

## 7. Frontend design

### Stack
- **Framework:** Next.js 15+ with App Router
- **Rendering:** Static for top-1000 products (SSG with ISR 1-hour); SSR for the rest
- **Styling:** Tailwind CSS (no custom CSS frameworks; design tokens via tailwind.config)
- **State:** React Server Components by default; client components for cart + search
- **Forms:** React Hook Form + Zod validation
- **Analytics:** Plausible (privacy-focused, no cookie banner needed)
- **Search UI:** Server-rendered with Turbo / View Transitions

### Page templates

#### Home page
- Hero: "Industrial pump & HVAC parts. Same-day shipping. 50,000+ SKUs."
- Prominent search box (autocomplete from `keywords` table)
- Top 8 brands grid (logos + brand name)
- Top 12 categories grid (icon + name + count)
- Recently published articles (3 latest)
- Trust strip: secure checkout, fast shipping, no-hassle returns

#### Search results
- Search input persistent at top
- Filter sidebar: brand (chip multi-select), category (tree), price range, in-stock toggle
- Result list: image, title, brand, part number, price, "Add to cart" button
- Cursor pagination (no offsets)
- "0 results found — did you mean [closest match]?" with trigram-based suggestion

#### Product detail (`/p/[brand-slug]/[part-number]`)
- Breadcrumb: Home › Pumps › Bell & Gossett › Series 80 › 186094LF
- Product image gallery (3-5 photos + diagram)
- Title (H1) with brand + part number
- Price + add-to-cart
- "Fits these pump models" pill list (links to model pages)
- Cross-references table (other part numbers for same product)
- Technical specs table
- Description (200-1500 words depending on tier)
- FAQ section (3-5 common questions)
- Related products (5 in same model, 5 in same category)
- JSON-LD Product + BreadcrumbList + FAQPage emitted

#### Brand page (`/b/[brand-slug]`)
- Brand logo + name + 1500-word brand bio
- Featured categories within brand
- Featured models within brand
- Top 50 SKUs grid
- Related brands ("Owned by Xylem" / "Replaced by")
- JSON-LD Organization + ItemList

#### Model page (`/m/[brand-slug]/[model-slug]`)
- Breadcrumb back to brand
- Model name + description + release year
- Predecessor / successor links
- All parts grid (paginated)
- Compatibility notes
- Common issues / maintenance tips article
- JSON-LD Product (model as parent) + ItemList

#### Article page (`/blog/[slug]`)
- Long-form content with TOC sidebar
- Related products at end (5 contextual)
- Author = "Nurtique technical team" (single byline)
- JSON-LD Article + BreadcrumbList

#### Checkout
- Single-page (no multi-step)
- Address autocomplete (Google Places or Mapbox free tier)
- Real-time tax calculation from `tax_rates` lookup on state
- Real-time shipping estimate (initial: flat $9.99 via dropdown; v2: per-distributor)
- Stripe Checkout for payment (PCI compliance handled by Stripe)

### Mobile-first principles
- Bottom nav with: Home, Search, Cart, Account
- Search bar = primary entry point on mobile home
- Tap-to-call CTA in product page footer (technicians on jobsite)
- Image gallery swipeable, lazy-loaded
- All forms inputs `inputmode` set correctly (`tel`, `email`, `numeric`)

---

## 8. Infrastructure

### AWS topology
```
Cloudflare DNS + WAF
       │
       ▼
AWS ALB (HTTPS, ACM cert for nurtique.com + *.nurtique.com)
       │
       ▼
EC2 instance (Ubuntu 24.04 LTS, t3.large at launch → m6i.xlarge at scale)
       │
       ├─ nginx (reverse proxy)
       │    ├─ /api/* → Express :4000
       │    └─ /*     → Next.js :3000
       │
       ├─ pgbouncer :6432
       │    └─ postgres :5432
       │
       └─ redis :6379

S3 buckets:
  nurtique-prod-images       (CloudFront in front)
  nurtique-prod-backups      (nightly pg_dump)
  nurtique-prod-wal-archive  (PITR, 7-day window)
```

### Sizing & cost (MVP)
| Resource | Spec | Monthly cost |
|---|---|---|
| EC2 t3.large | 2 vCPU / 8 GB | $60 |
| EBS gp3 (root + DB + Docker) | 280 GB total | $25 |
| ALB | with ACM cert | $20 |
| S3 + CloudFront | 15 GB images + 50 GB transfer | $5 |
| Route 53 hosted zone | nurtique.com | $1 |
| Cloudflare | Free tier | $0 |
| **Total** | | **~$110/mo** |

Scale to ~$300/mo at 1M req/day (t3.xlarge + Redis Cloud + read replica).

### Backups (3-2-1)
- `pg_dump` nightly → S3 (encrypted via KMS)
- WAL archive continuous → S3 (PITR 7-day window)
- EBS snapshot daily via DLM (14-day retention)
- Restore drill monthly (scripted, must succeed before each deploy of schema changes)

### Monitoring
- `postgres_exporter` + Grafana Cloud free tier
- Sentry for error tracking ($26/mo team plan)
- Plausible for traffic (self-hosted Docker, free) or $9/mo cloud
- Healthchecks.io for cron heartbeats (free)

---

## 9. SEO & content

### The strategy in one sentence

**Build factual content so genuinely useful that humans share it AND AI assistants cite it.** Every other SEO lever (keyword stuffing, programmatic AI commerce pages, link farms) is being actively demoted. Real content with citation-grade rigor is the only strategy with a 5-year half-life.

### The two-track content model

Stop trying to AI-draft 50,000 thin product pages — that pattern is exactly what Google's Helpful Content Update demotes. Instead, **two distinct content tracks**:

| Track | Pages | Content shape | Effort per page | Audience signal |
|---|---|---|---|---|
| **Reference (stub) pages** | 50,000 | Factual minimums only: cross-ref table, dimensions, source-cited specs, image. NO prose, NO marketing. | 30 seconds (auto-generated from structured data) | Tier-1 / -2 from `product_scores` upgrade over time |
| **Deep pages** | 500-2,000 | Multi-audience deep content (see below). Human-reviewed by domain expert. | 2-4 hours per page | The "AI-citation moat" — these are the pages that get cited |

Google distinguishes **thin-by-design** (a factual reference page that's deliberately minimal) from **thin-by-laziness** (programmatic AI fluff). The stub pages clearly signal "reference manual" via structured data and explicit lack of marketing copy. They don't get demoted; they just earn modest rankings. The deep pages do the heavy ranking work.

### The four page types
| Page | URL | Ranks for | Volume | Content depth |
|---|---|---|---|---|
| **SKU stub** | `/p/[brand]/[part]` | `[brand] [part]` | 30-50K | Reference (~50-150 words of facts) |
| **SKU deep** | `/p/[brand]/[part]` (upgraded) | `[brand] [part]` + related | 500-2K | 1,200-2,000 words multi-audience |
| **Model** | `/m/[brand]/[model]` | `[brand] [model] parts` | 500-2K | 1,500-3,000 words |
| **Brand** | `/b/[brand]` | `[brand] catalog` + brand history | 200-500 | 2,000-4,000 words |
| **Article** | `/blog/[slug]` | how-to / vs / troubleshoot | 100-500 | 2,000-4,000 words |

### What a deep SKU page contains (the AI-citation template)

Every deep page has these sections, each speaking to a different audience without watering down:

1. **Fact block (technicians).** Exact dimensions, material codes, pressure/temp/RPM ratings, cross-reference table, compatible pump models with frame designations. Source-cited from manufacturer documentation.
2. **Diagnostic section (homeowners + on-site contractors).** "How do I know my seal is failing?" with specific symptoms. "Can I replace this myself?" with honest skill threshold. Real DIY failure modes. When to call a pro.
3. **Engineering "why" (students + curious techs).** How the part actually works. Engineering tradeoffs. Failure mode analysis. Comparison to alternate designs.
4. **Decision aid (everyone).** "Should I buy this or [alternate cross-ref]?" — with a real recommendation, not a sales pitch. Sometimes the right answer is "don't buy yet, check this first."
5. **Sources and provenance.** Linked manufacturer datasheets. Citations to engineering standards (API 682, ANSI/HI 7.1). "Reviewed [date] by [name], [credentials]."

### Optimizing for AI-assistant citation specifically

ChatGPT browse, Perplexity, Gemini, Claude Search cite content that has:

1. **Definitive language.** "The B&G 186094LF replaces the discontinued 178600 (2007)." Not: "Some users report it may replace older models."
2. **Structured fact tables.** Machine-readable comparison tables with proper HTML semantics. AI assistants extract these directly.
3. **Original data only we have.** Cross-reference matrices, brand-acquisition history (Goulds → ITT → ITT/Goulds → Goulds Water Technology), model evolution paths. The U.S. Seal Pump Cross-Reference PDF we parsed contains data most websites don't expose cleanly.
4. **Schema beyond Product.** `HowTo` for replacement procedures. `QAPage` for FAQs. `Article` for educational content. `DefinedTermSet` for technical glossaries. `Dataset` for cross-reference tables.
5. **Citations and provenance.** Every factual claim sourced. AI weights cited content higher because it must attribute.
6. **Author / publisher entity signals.** "Nurtique Engineering" entity with consistent `Organization` schema across pages. Author profile pages for the human reviewer with credentials.
7. **Updated dates that mean something.** Not autoupdated nonsense — actually updated when manufacturer data changes, with a changelog if possible.

### Free keyword acquisition
- **Google autocomplete** (`suggestqueries.google.com`) — pace 1 req/3s, rotate UAs
- **SERP scraping** via stealth Puppeteer — top-10 results per SKU
- **Related Searches** at SERP bottom — gold for article topics
- **People Also Ask** boxes — gold for FAQ section content
- **Google Trends** for brand/category-level trends

Volume estimates as bands (low <50, medium 50-500, high >500). Good enough for ordering; precise numbers when we eventually pay for Ahrefs.

### Content production workflow

**Reference stub pages (50K):**
- Auto-generated from `products` + `part_number_aliases` + `models` + `brands` + scraped specs
- No AI prose. Templated, factual, with explicit "Reference page" semantic markup
- Published in bulk via sitemap submission
- Upgraded to "deep" tier when `product_scores` indicates organic traffic or revenue

**Deep pages (500-2K, the moat):**
1. Score job identifies tier-1 candidates from `product_scores`
2. Claude generates a STRUCTURED draft with the 5-section template (not prose; section by section, fact-first)
3. **Domain expert reviewer** edits every page — fact-checks, adds field-experience commentary, kills hallucinations
4. Optional: technical illustrator generates a custom cross-section diagram (or we license from manufacturer where permitted)
5. Status flows: `draft → claude_drafted → expert_review → revisions → approved → published`

**Realistic production rate:**
- 5-10 deep pages/week with expert review (sustainable)
- 20-40 deep pages/week with Claude + expert at high cadence (achievable for 1-2 month sprints, not sustained)
- 100+/week is the rate at which quality drops and Google notices

**Hitting 1,000 deep pages takes ~25-50 weeks at sustainable pace.** Plan accordingly.

### The expertise role (critical, not optional)

The deep-content track requires someone with hands-on industry experience. Options:

1. **Hire part-time content reviewer** — retired HVAC tech or pump rebuilder, ~$500-1,500/month for 5-10 hours/week
2. **Co-founder for equity** — former service tech or contractor, 10-30% equity
3. **Self-teach by shadowing** — spend 1 week shadowing a service tech, document everything, repeat quarterly
4. **Interview-based content** — pay techs $50-100 per recorded interview, transcribe + edit into authoritative content (cheapest path)

**You cannot ship the AI-citation strategy without one of these.** Claude-drafted content reviewed only by a developer will contain plausible-sounding errors that destroy the trust we need.

### Internal linking density
- Every SKU page: 15-25 inbound links (model, brand, category, cross-refs, related, articles)
- Authority cascade: brand pages earn backlinks → push models → push SKUs → push reference stubs

### Technical SEO checklist (every page)
- `<title>` 50-60 chars, includes primary keyword
- `<meta description>` 140-160 chars
- `<link rel="canonical">`
- JSON-LD per page type: Product / BreadcrumbList / FAQPage / HowTo / Article / Organization / Dataset / DefinedTermSet
- OpenGraph + Twitter Card meta
- Sitemap.xml split: sitemap-products-stub.xml, sitemap-products-deep.xml, sitemap-articles.xml, sitemap-brands.xml, sitemap-models.xml
- robots.txt: allow all except /admin, /api, /_next
- Core Web Vitals targets: LCP <2.0s, INP <200ms, CLS <0.1
- Mobile-first responsive layout
- HTTPS + HSTS
- `llms.txt` at root — emerging spec for telling AI assistants what content to use (we'll publish it)

---

## 10. Marketing plan

### Channel mix (year 1)

| Channel | Effort | Cost | Year-1 impact |
|---|---|---|---|
| Organic Google SEO | 70% | $0 | The whole game |
| Reddit/forum participation | 10% | $0 | Quality backlinks + early credibility |
| YouTube tutorials | 8% | $0 | Long-tail video search |
| LinkedIn content | 5% | $0 | B2B authority |
| Email marketing | 5% | $20/mo | Repeat customer LTV |
| Paid Google Ads | 2% | $500/mo from M6 | Awareness data + competitive intel |

Paid ads are LAST. We don't have margin to compete on bids until we have organic traffic.

### Launch sequence

**Month 1 — Soft launch**
- Site live with 1,000-5,000 SKU pages indexed
- Submit sitemaps to Google + Bing
- File 5-10 hand-picked SKU pages for manual indexing in GSC
- Set up Plausible analytics + GSC + GA4 (for benchmarking only)
- Announce on personal LinkedIn (low key — "shipped a thing")

**Month 2 — Content velocity**
- Publish 50-100 articles (mostly Claude-drafted, you review)
- Reddit participation: answer 10+ questions/week in r/HVAC, r/Plumbing, r/Pumps
- Comment on relevant LinkedIn industry posts (no spam — actual value adds)
- First YouTube video: "How to identify your B&G pump model" (5-min)

**Month 3 — Backlink building**
- Identify 20 industry blogs/sites that might link to us
- Outreach with custom value: "We have a cross-reference tool that solves X for your readers"
- Submit to industry directories (ThomasNet, IndustryNet)
- Apply for guest-post slots on HVAC trade blogs

**Month 6 — Paid experiments**
- $500/mo Google Ads test: bid on 50 SKU queries we already rank #4-10 on
- Goal: data, not conversion. Learn keywords that convert, then SEO toward them.
- Launch first email marketing flow (welcome series)

**Month 12 — Scale**
- 10K+ ranked pages
- Email list 1K+ subscribers
- YouTube channel 50+ videos
- Considering paid acquisition more seriously

### Backlink strategy
Backlinks > on-page SEO at our stage. Sources we'll pursue:
- Manufacturer cross-reference inclusion ("Our authorized resellers include nurtique.com")
- Industry forums (HVAC-Talk, Eng-Tips, HeatingHelp) — answer questions with permanent links
- Trade publications (FE&S, Contractor magazine) — pitch op-eds
- Reddit comments (r/HVAC AMA-style threads)
- HARO-style PR requests (Help A Reporter Out)
- Wikipedia citations (where genuinely warranted — never spammy)

Target: 50 quality referring domains by month 6, 200 by month 12.

---

## 11. Email templates

### Tooling
- **Provider:** Resend ($20/mo, 50K emails/mo)
- **Template engine:** MJML (markdown-like, compiles to reliable cross-client HTML)
- **List management:** Postgres `email_subscribers` table
- **Deliverability:** SPF + DKIM + DMARC on nurtique.com from day 1

### Transactional templates (must-haves)

1. **Order confirmation**
   - Subject: `Order #ORD-2026-001234 confirmed — shipping soon`
   - Body: line items, total, shipping address, expected delivery window, "Reply with questions"
   - Sent within 5 seconds of `orders.status = 'paid'`

2. **Shipping notification**
   - Subject: `Your order has shipped — tracking inside`
   - Body: carrier, tracking number (linked to carrier site), estimated delivery
   - Sent when `shipments.status = 'shipped'`

3. **Delivered notification**
   - Subject: `Delivered. Need anything else?`
   - Body: brief confirmation + "Found a problem? Reply to this email."
   - Sent 1 hour after `shipments.status = 'delivered'`

4. **Return started**
   - Subject: `Return started for order #ORD-2026-001234`
   - Body: return shipping label PDF link, instructions, refund timeline
   - Sent when admin marks order for return

5. **Refund completed**
   - Subject: `Refund of $XX.XX processed`
   - Body: amount, original payment method, "3-5 business days to appear"

### Marketing templates (lighter rollout)

1. **Welcome series** (3-email sequence on signup)
   - Email 1 (immediate): "Welcome — here's what we do"
   - Email 2 (day 3): "How to find any part on Nurtique" (with quick-search tutorial)
   - Email 3 (day 7): "5 most-replaced parts in HVAC systems" (content piece)

2. **Abandoned cart** (24h + 72h)
   - Subject: `Still considering [product]?`
   - Body: product image, "questions?", easy "complete checkout" link

3. **Reorder reminder** (for consumables, ~90 days after purchase)
   - Subject: `Time to reorder your B&G 186094LF?`
   - Body: based on average replacement cycle, one-click reorder button

4. **Monthly digest** (opt-in)
   - Subject: `Nurtique monthly: [headline article + 3 new SKUs]`
   - Body: 1 featured article, 3 new SKUs, top selling category

### Voice in emails
- First-person plural ("We saw your order shipped" — not "Your order has been shipped" passive)
- Short subject lines, action-oriented
- No emojis in transactional, sparingly in marketing
- Plain-text fallback for every HTML email (better deliverability)

---

## 12. Social media

### Platforms (ranked by ROI for our niche)

#### 1. LinkedIn (primary B2B channel)
- **Profile:** Company page with logo, banner, About copy emphasizing technical depth
- **Cadence:** 3 posts/week
- **Content types:**
  - "Behind the scenes" — how we identified an obscure cross-reference (technical credibility)
  - Industry news commentary — when ITT/Xylem announces a model change, we explain implications
  - Customer wins (anonymized) — "Helped a facility manager find a discontinued Series 60 seal in 4 minutes"
  - Original research — "We scraped 50K HVAC sensor SKUs. Here's the brand consolidation map."
- **Goal:** B2B authority + referring traffic + occasional contractor sales

#### 2. YouTube (long-tail tutorial videos)
- **Cadence:** 1-2 videos/month
- **Format:** Screen recording + voiceover + product photo cutaways. No on-camera.
- **Topics:**
  - "How to identify your Bell & Gossett pump model" (high-volume search)
  - "B&G 186094LF vs 189141 — what's the difference?"
  - "Replacing a Goulds 3196 cartridge seal — step-by-step"
  - "Cross-referencing Honeywell HVAC controls to Belimo equivalents"
- **Why YouTube:** every video has a description with backlinks to relevant SKU pages. Multiplier on search authority.

#### 3. Reddit (community, not promotion)
- **Subs:** r/HVAC, r/Plumbing, r/Pumps, r/HVACAdvice, r/Plumber, r/Mechanic, r/FacilityMaintenance
- **Cadence:** answer 10+ questions/week with genuine expertise
- **Account:** authentic, real first name, no obvious shilling
- **Self-promo:** never first; only when directly answering a question that warrants linking a cross-reference page
- **Goal:** earn moderator trust + 5-10% of helpful answers turn into Nurtique referrals

#### 4. Twitter/X (lower priority, monitor more than post)
- **Cadence:** 1-2 posts/week — typically share LinkedIn content with a thread
- **Use:** monitor industry conversations + brand mentions

### Skipping (wrong audience)
- TikTok / Instagram / Pinterest — our buyers are 35-65 male HVAC techs. Not on these.

### Profile setup checklist
- Consistent name "Nurtique" across all platforms
- Same logo / banner (brand kit assets)
- Bio: "Industrial pump seals + HVAC controls. 50,000 cross-references. Same-day shipping."
- Link in bio: nurtique.com
- Pinned post: link to the part-number search tool
- Email contact: hello@nurtique.com

---

## 13. Operations & fulfillment

### Order flow
```
Customer → Stripe Checkout → orders.status = 'paid'
   │
   ▼
Webhook handler classifies items by distributor (product_fulfillment table)
   │
   ▼
Per distributor → create shipments row → submit via api/email/portal
   │
   ▼
Distributor confirms → status='accepted' → tracking number stored
   │
   ▼
Carrier webhook → shipped → in_transit → delivered
   │
   ▼
orders.status = 'delivered' when ALL shipments delivered
   │
   ▼
T+1 hr → "Delivered" email sent
T+14 days → reorder reminder email scheduled (consumables only)
```

### Distributor relationships (Phase 1)
At launch, we operate at lower distributor tier (CC pre-pay, no Net-30):
- HVAC USA (HVAC controls drop-ship)
- Blackhawk Supply (Belimo + JCI + BAPI)
- Sealsales.com (mechanical seals — affiliate first)
- MSC ResaleLink (blind drop-ship, general industrial)

Manufacturer-direct (US Seal, Vulcan, AST) applications are the Phase-2 outreach project (45K SKU agent we discussed earlier).

### Customer service
- Email-only at launch (`support@nurtique.com`)
- Response SLA: 24h business days
- Common scripts pre-templated for: "wrong part received," "tracking question," "return request"
- All emails BCC'd to a shared inbox for transparency
- Phone support only when revenue justifies a part-time CS hire (~$5K MRR)

---

## 14. Metrics & success criteria

### What we measure monthly

**Acquisition:**
- Indexed pages in Google Search Console (split: stub pages vs deep pages)
- Pages in top 10 / top 3 for primary keyword (`[brand] [part-number]`)
- Organic clicks (GSC)
- Referring domains (Ahrefs free trial monthly check)
- **AI-citation count** — how many times our pages appear as cited sources in ChatGPT browse / Perplexity / Gemini responses for our target queries (manual check monthly, ~50 sample queries)

**Engagement:**
- Pageviews + unique visitors (Plausible)
- Search usage rate (% of sessions that use search bar)
- Average session duration
- Bounce rate per page type

**Conversion:**
- Add-to-cart rate
- Checkout completion rate
- Orders per month
- Average order value
- Repeat purchase rate (only meaningful by month 6+)

**Operational:**
- Order-to-ship time (target <24h business)
- Distributor on-time rate (target >95%)
- Return rate (target <3%)
- Customer service tickets per 100 orders

**Financial:**
- Revenue
- Gross margin (after distributor cost + Stripe fees + shipping)
- Customer acquisition cost (target <$30 at launch)
- LTV/CAC ratio (target >3× by month 6)

### Year-1 targets (calibrated to two-track content model)

| Month | Stub pages indexed | Deep pages published | Top-3 rankings | AI citations | Orders/mo | Revenue/mo |
|---|---|---|---|---|---|---|
| 1 | 5K | 50 | 20 | 0 | 2-5 | $150 |
| 3 | 20K | 200 | 200 | 0-5 | 30 | $1,500 |
| 6 | 35K | 500 | 1,000 | 5-15 | 120 | $7K |
| 12 | 50K | 1,500 | 5,000-10,000 | 50-200 | 350 | $20K |

Adjustments from prior plan:
- **Lower revenue ramp.** Deep content production is the bottleneck. Expert review caps weekly velocity at 5-10 deep pages.
- **AI-citation metric added.** This is the durable moat. Even at low absolute numbers in year 1, the trajectory matters more than the count.
- **Hitting 50% of these targets is still a real business.** Hitting 30% is still worth doing.

**Probability framing:** ~25-35% chance to reach the year-1 revenue target. ~15-25% chance to become a cited AI-assistant source in our niche. ~50-60% chance the site ships and earns at least sustaining revenue. The strategy has a higher long-term ceiling than the pure-AI-content version it replaces.

---

## 15. Roadmap

### Phase 1: Foundation (Weeks 1-4)
- **Week 1:** Repo setup (pnpm monorepo, Docker, CI/CD, dbmate). EC2 + RDS-replacing Postgres on instance. Domain + Cloudflare. Sentry + Plausible.
- **Week 2:** Schema migrations + staging ingestion. Brand alias seed + canonical brand list. Categories tree seeded.
- **Week 3:** Curation pipeline. Score 50K products. Manual review of brand normalization edge cases.
- **Week 4:** Keyword scraping agent (Google autocomplete + SERP + related). Initial keyword data for top 10K products.

### Phase 2: Backend & Frontend (Weeks 5-8)
- **Week 5:** Express API: search (3 modes), product detail, brand, model, category endpoints. Rate limiting + Redis caching.
- **Week 6:** Next.js storefront: home, search, SKU page, brand page, model page templates.
- **Week 7:** Image pipeline (S3 + sharp + 6 variants), admin upload. Stripe Checkout integration.
- **Week 8:** Order flow + shipment creation + EasyPost/Shippo webhook integration. Email transactional templates via Resend.

### Phase 3: Content scaffolding (Weeks 9-12)
- **Week 9:** Auto-generate all 50K stub pages from `products` + `part_number_aliases`. Strict factual minimums. Publish behind a `noindex` header initially.
- **Week 10:** Deep-content template + Claude prompt engineering (the 5-section structure). First 20 deep pages drafted for top brands (B&G, Goulds, Belimo). **Expert reviewer onboarded.**
- **Week 11:** Expert review pipeline running. First 20 deep pages published. Brand articles for top 10 brands. Audit Core Web Vitals.
- **Week 12:** Sitemap generation + GSC submission. Stub pages flip from `noindex` to `index`. First indexing checkpoint at Google. First batch of 20 deep pages indexed and tested against AI-assistant citation (manual check: ChatGPT browse, Perplexity).

### Phase 4: Launch + Marketing (Weeks 13-16)
- **Week 13:** Soft launch: site live, search functional, 50K stubs + ~50 deep pages published. Cloudflare on. Sentry + Plausible reporting.
- **Week 14:** Reddit participation begins. LinkedIn company page launched. First YouTube video. Continue deep-page production at 5-10/week.
- **Week 15:** Backlink outreach starts. Email welcome series live. Production rate target: 100 deep pages cumulative.
- **Week 16:** First paid order shipped (target — modest given low deep-page count). Retrospective + adjust pace. Identify first AI-citation wins (or absence) and iterate.

### Phase 5: Scale (Months 5-12)
- Manufacturer-direct outreach (the AI agent we deferred from EXECUTION_PLAN)
- Image-based search (OCR + pgvector embeddings)
- Bulk-quote system for facility-manager customers
- Net-30 customer accounts
- A/B testing on PDP layouts + conversion

---

## 16. Open decisions

These need your input before any code touches the new repo:

1. **Domain expert / content reviewer** — **the most important decision in this document.** Without one, the AI-citation moat doesn't materialize. Options:
   - Hire part-time retired tech ($500-1,500/mo for 5-10 hrs/wk)
   - Co-founder for 10-30% equity
   - Pay-per-interview model with active techs ($50-100 per recorded interview)
   - Self-teach by shadowing service techs
   - Pick one before week 10.
2. **Runway capital plan** — $1K alone won't fund 12-18 months. What's the day-job / savings / partner-capital plan that covers $110-200/mo infra + $500-1,500/mo content reviewer + your time?
3. **AWS account access** — you own it; I document but don't provision.
4. **Stripe account** — sign up in test mode now so we have keys for week-7 checkout integration.
5. **Cloudflare account** — already on it? Or need to set up?
6. **Resend account** — sign up + verify nurtique.com sender domain (SPF/DKIM/DMARC) by week-7.
7. **EasyPost vs Shippo** — for tracking aggregation. Both ~$0.01/lookup. Pick one and create account.
8. **Designer for logo** — $200-500 contract on Fiverr/Dribbble before week-12 launch. Or skip with text-only logo + buy proper one at month 3 with revenue.
9. **GSC + GA4 + Bing Webmaster** — accounts created and verified ownership during week-1.
10. **GitHub Actions secrets** — DB credentials, AWS keys, Stripe keys, Resend API key. Vaulted in GitHub repo settings.
11. **Admin bearer token strategy** — single env-injected `ADMIN_BEARER_TOKEN` for now, swap to Clerk/Auth0 when 2+ admins exist.
12. **First 10 sample SKUs you want me to manually QA** before we trust the curation pipeline at scale.
13. **Niche scope decision** — do we launch with BOTH pump seals AND HVAC controls, or narrow to one for the first 6 months to concentrate authority and expertise? Narrower probably ships higher quality faster.

---

## What this document supersedes

- `STRATEGY.md` — superseded by section 1-2
- `INDUSTRIAL_SEO_NICHES.md` — superseded by section 2 (niche choice locked in)
- `DEMAND_ANALYSIS.md` — reference only (rationale archive)
- `SOURCING_PLAYBOOK.md` — superseded by section 13
- `MANUFACTURER_DIRECT_SOURCING.md` — referenced for Phase-5 outreach
- `EXECUTION_PLAN.md` — superseded by section 15
- `BACKEND_PLAN.md` — superseded by sections 5-6
- `IMPLEMENTATION_GUIDE.md` — superseded by sections 6-8
- `INFRA_AND_MIGRATIONS.md` — superseded by section 8 + DB schema details
- `CONTENT_AND_SEO.md` — superseded by section 9

**Companions kept:**
- The reference docs above stay in the repo for deeper context — this doc is canonical, they're appendices.

---

## Next step

You said "we create new repo." Whenever you're ready to spin up `github.com/winsley-jeune/nurtique`, ping me. I'll walk through the initial commit structure with you (you driving git, me sanity-checking).

Until then, push back on anything in this doc that doesn't fit how you actually want to build this.
