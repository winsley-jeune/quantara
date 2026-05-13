# Infrastructure + Migrations — Final Layer

Appendix to `IMPLEMENTATION_GUIDE.md`. AWS + dropshipping + migration tool research.

---

## 1. AWS topology

```
                         ┌──────────────────────┐
                         │   Cloudflare DNS     │ nurtique.com → ALB
                         │   + WAF + Bot Mgmt   │
                         └──────────┬───────────┘
                                    │
                              ┌─────▼─────┐
                              │ AWS ALB   │ :443 (ACM cert)
                              └─────┬─────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │       Target group → EC2          │
                  │       (HTTPS → nginx :443)        │
                  └─────────────────┬─────────────────┘
                                    │
        ┌───────────────────────────▼───────────────────────────┐
        │  EC2 instance — Ubuntu 24.04 LTS                      │
        │  Recommended: t3.large (2 vCPU / 8GB) for MVP         │
        │  Scale to: t3.xlarge (4/16) / m6i.xlarge (4/16) later │
        │                                                       │
        │  Docker compose stack:                                │
        │    nginx ─► next.js:3000 ─► express:4000              │
        │                                  │                    │
        │                                  ├─► pgbouncer:6432   │
        │                                  │     └─► postgres:5432
        │                                  └─► redis:6379       │
        │                                                       │
        │  EBS volumes:                                         │
        │    /         (root)        gp3 30GB                   │
        │    /var/lib/postgres       gp3 200GB (separate vol)   │
        │    /var/lib/docker         gp3 50GB (separate vol)    │
        └───────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌───────────────────────────────────────────────────────┐
        │  S3: nurtique-prod-images        (CloudFront in front) │
        │  S3: nurtique-prod-backups       (pg_dump nightly)     │
        │  S3: nurtique-prod-wal-archive   (PITR for postgres)   │
        └───────────────────────────────────────────────────────┘
```

**Why this shape and not RDS:** you said self-hosted. RDS would be cleaner (managed backups, automatic failover, no ops burden) but locks you to AWS pricing + you lose root-level config control. Self-hosted on EC2 gives you portability and ~50% cheaper at small scale. Revisit when DB CPU consistently >70% — that's when RDS Multi-AZ starts justifying its premium.

**ACM cert** issued for `nurtique.com` + `*.nurtique.com`. Attached to ALB. Cloudflare in proxied mode talks to ALB over HTTPS.

**Security groups:**
- ALB SG: inbound 80/443 from 0.0.0.0/0 (but Cloudflare IPs only via ALB listener rules)
- EC2 SG: inbound 443 only from ALB SG; inbound 22 only from your IP (or bastion)
- No public IP on EC2 if behind ALB (use private subnet + NAT for outbound)

**Backups (3-2-1 rule):**
- Nightly `pg_dump` → S3 (encrypted at rest with KMS)
- WAL archive continuous → S3 (PITR window: 7 days)
- EBS snapshot daily via DLM (Data Lifecycle Manager) — 14-day retention
- Restore drill: monthly, scripted (this is the part everyone skips)

**Why nginx in front of Next.js + Express on the same box:**
- Single TLS cert handoff from ALB
- Easy path-based routing (`/api/*` → Express, everything else → Next.js)
- Static asset serving with proper cache headers
- Lets you swap out either app without ALB-level changes

---

## 2. Dropshipping schema

You don't hold inventory. Distributor ships blind-labeled directly to customer. You still need a `shipments` table for customer service / tracking lookup / dispute handling.

```sql
-- Distributors you've been authorized through (e.g. Vulcan Seals, U.S. Seal, HVAC USA)
-- These are the operational fulfillment relationships.
-- (Distinct from `manufacturers` table which is the outreach pipeline.)
CREATE TABLE distributors (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  contact_email        CITEXT,
  contact_phone        TEXT,
  api_endpoint         TEXT,                       -- if they have an order API
  api_key_secret       TEXT,                       -- encrypted (KMS) or in AWS Secrets Manager
  order_method         TEXT NOT NULL,              -- 'api' | 'email' | 'portal_manual'
  blind_shipping       BOOLEAN DEFAULT TRUE,
  net_payment_terms    TEXT,                       -- 'CC_prepay' | 'NET_15' | 'NET_30'
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which distributor(s) can fulfill which product. One product, many distributors.
CREATE TABLE product_fulfillment (
  id                   BIGSERIAL PRIMARY KEY,
  product_id           BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  distributor_id       BIGINT NOT NULL REFERENCES distributors(id),
  distributor_sku      TEXT,                       -- their SKU (may differ from yours)
  wholesale_cents      INTEGER NOT NULL,
  shipping_cents       INTEGER NOT NULL DEFAULT 0, -- typical ship cost from this distributor
  lead_time_days       SMALLINT,
  in_stock             BOOLEAN DEFAULT TRUE,
  is_primary           BOOLEAN DEFAULT FALSE,      -- preferred fulfillment source
  last_checked_at      TIMESTAMPTZ,
  UNIQUE (product_id, distributor_id)
);
CREATE INDEX idx_fulfillment_product     ON product_fulfillment(product_id);
CREATE INDEX idx_fulfillment_distributor ON product_fulfillment(distributor_id);
CREATE INDEX idx_fulfillment_primary     ON product_fulfillment(product_id) WHERE is_primary = TRUE;

-- One shipment per (order, distributor). An order can split if items come
-- from different distributors. Tracks the leg from distributor → customer.
CREATE TABLE shipments (
  id                   BIGSERIAL PRIMARY KEY,
  order_id             BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  distributor_id       BIGINT NOT NULL REFERENCES distributors(id),
  distributor_order_ref TEXT,                      -- their PO number / confirmation
  carrier              TEXT,                       -- 'UPS' | 'FedEx' | 'USPS' | 'distributor_truck'
  service              TEXT,                       -- 'Ground' | 'Next Day Air' | etc.
  tracking_number      TEXT,
  tracking_url         TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'submitted_to_distributor' | 'accepted' | 'shipped' |
  -- 'in_transit' | 'delivered' | 'returned' | 'failed'
  submitted_at         TIMESTAMPTZ,
  shipped_at           TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  cost_cents           INTEGER,                    -- what distributor charged you
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shipments_order        ON shipments(order_id);
CREATE INDEX idx_shipments_status       ON shipments(status);
CREATE INDEX idx_shipments_tracking     ON shipments(tracking_number);

-- Which order items are on which shipment (an item can be split, though rare)
CREATE TABLE shipment_items (
  id              BIGSERIAL PRIMARY KEY,
  shipment_id     BIGINT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id   BIGINT NOT NULL REFERENCES order_items(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX idx_shipment_items_shipment ON shipment_items(shipment_id);
```

**Order → shipment flow (dropship):**

```
Order placed (PAID)
   │
   ▼
Group order_items by primary distributor
   │
   ▼
For each distributor:
   - Create shipments row (status: 'pending')
   - Submit via order_method:
     ├─ 'api'           → call distributor API, store distributor_order_ref
     ├─ 'email'         → email with order detail to distributor (templated)
     └─ 'portal_manual' → flag for human action in admin dashboard
   - shipments.status = 'submitted_to_distributor'
   │
   ▼
Poll / webhook (distributor confirms acceptance)
   - status = 'accepted', set carrier/service/tracking when known
   │
   ▼
Carrier tracking webhook (EasyPost / Shippo / direct carrier API)
   - status flows: shipped → in_transit → delivered
   - update orders.status = 'shipped' when first shipment ships
   - update orders.status = 'delivered' when last shipment delivers
```

**Tracking aggregation:** use [EasyPost](https://www.easypost.com) or [Shippo](https://goshippo.com) for unified tracking webhooks across UPS/FedEx/USPS — saves writing N carrier integrations. ~$0.01/tracking lookup.

---

## 3. Migration tool comparison

You wanted to investigate. Here are the realistic top 3 for your stack, with my recommendation at the bottom:

### Option A — **dbmate** (raw SQL, language-agnostic)

- Each migration is two SQL files: `001_initial.up.sql` + `001_initial.down.sql`
- Single binary, no Node dependency
- Works against any DB
- Migration state stored in a `schema_migrations` table

**Pros:** Brutally simple. Real SQL, no DSL to learn. Survives any framework change.
**Cons:** No types. No diffing — you write every migration by hand.

```
$ dbmate new add_products_table
$ dbmate up
$ dbmate down
```

### Option B — **node-pg-migrate** (JS-based migrations)

- Migrations are JS/TS files with `up` and `down` functions
- Imperative API: `pgm.createTable('products', { ... })`
- Mature, widely used

**Pros:** Programmatic — you can compute schema based on env vars, loop over arrays, etc.
**Cons:** Yet another DSL to learn. Migration files are uglier than raw SQL.

### Option C — **drizzle-kit** (typed schema → generated migrations)

- Define schema in TS: `export const products = pgTable('products', { ... })`
- `drizzle-kit generate` diffs your TS schema against the DB and emits SQL
- Pairs with Drizzle ORM (you can also use Kysely or raw `pg` alongside)

**Pros:** TS-first. Types flow through to your queries. Auto-generates migrations.
**Cons:** Tightly couples your schema to TS. Generated SQL sometimes needs hand-editing for tricky migrations (extensions, triggers, GIN indexes with custom ops).

### My recommendation

**dbmate.** Reasons:
1. You're already comfortable with SQL (you've shipped a 6K-SKU WooCommerce site).
2. Pg-specific features (pg_trgm, tsvector, triggers, GIN with `gin_trgm_ops`) are easier to write by hand than to coax a generator into producing.
3. Self-hosted Postgres means tight control matters — you want to read every migration before it runs.
4. Single binary, dead simple, no NPM dependency churn.

Add Kysely (no migrations, just queries) for typed reads at runtime. Best of both worlds.

```json
// package.json scripts
"db:migrate": "dbmate up",
"db:rollback": "dbmate rollback",
"db:new": "dbmate new"
```

If you'd rather have the type-safety bridge: use **drizzle-kit for generation** + commit the generated SQL files. You get the typed schema definition without trusting the generator at runtime.

---

## 4. pnpm workspaces layout (final)

```
quantara/                          (repo root)
├── pnpm-workspace.yaml
├── package.json                   (workspace scripts only)
├── apps/
│   ├── api/                       Express
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/...
│   ├── web/                       Next.js
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/...
│   └── agent/                     scraper + manufacturer outreach
│       ├── package.json
│       └── src/...
├── packages/
│   └── shared/                    types shared between api + web
│       ├── package.json
│       └── src/...
├── db/
│   ├── migrations/                dbmate SQL files
│   │   ├── 20260513120000_initial.up.sql
│   │   ├── 20260513120000_initial.down.sql
│   │   └── ...
│   ├── seeds/
│   │   ├── 001_brands.sql
│   │   ├── 002_tax_rates.sql
│   │   └── 003_categories.sql
│   └── dbmate.env
├── infra/
│   ├── docker-compose.yml
│   ├── nginx.conf
│   ├── postgres.conf
│   ├── pgbouncer.ini
│   ├── backup.sh
│   ├── restore.sh
│   └── terraform/                 (optional — for EC2 / S3 / ALB IaC)
└── data/                          (gitignored)
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Common scripts at root `package.json`:

```json
{
  "scripts": {
    "api:dev":   "pnpm --filter @nurtique/api dev",
    "web:dev":   "pnpm --filter @nurtique/web dev",
    "agent":    "pnpm --filter @nurtique/agent run",
    "db:migrate": "dbmate -d db/migrations up",
    "db:new":     "dbmate -d db/migrations new",
    "typecheck": "pnpm -r typecheck",
    "lint":      "pnpm -r lint",
    "test":      "pnpm -r test"
  }
}
```

---

## 5. What I'll write next (your call)

In order:

1. **First migration file** — `20260513120000_initial.up.sql` covering brands, brand_aliases, categories, products, part_number_aliases, product_images, staging_raw_skus, manufacturers, outreach_events, pricing, tax_rates, tax_nexus, orders, order_items, distributors, product_fulfillment, shipments, shipment_items. Plus extensions: `citext`, `pg_trgm`, `unaccent`.

2. **`infra/docker-compose.yml`** — local-dev parity with prod (postgres 16 + pgbouncer + redis on a docker network).

3. **Seed scripts** — initial brands list, US tax rates, top-level categories.

4. **`apps/api` skeleton** — Express + Kysely + Pino + Zod + rate limit middleware. One working `/api/health` and one working `/api/search?q=` endpoint demonstrating all three search modes.

5. **Curation pipeline** — `apps/agent/scripts/curate.ts` reading staging → products with the 6-step pipeline.

Order makes sense? Or do you want me to start somewhere else?

---

## 6. Open / pending

- **AWS account access** — I assume you have it. I'm not provisioning EC2 for you; you do that. I write the docker-compose + config files.
- **Cloudflare on `nurtique.com`** — you do the DNS / nameserver swap. I write the WAF rule snippets and rate-limiting config.
- **`AWS_REGION`** — default to `us-east-1` unless you say otherwise. Affects CloudFront edge selection less; affects S3 bucket region pricing.
- **First admin** — you'll need a bearer token / API key for the admin upload endpoints. Plan: env-injected `ADMIN_BEARER_TOKEN`. When you eventually want real auth (multi-admin), bolt on Clerk or Auth0.
- **Stripe** — for checkout. Set up account in test mode now so we have keys when we wire up `/api/checkout`. Stripe Tax not yet (we have tax_rates table for MVP).

Confirm:
- "go" → I write the migration file first.
- "different order" → tell me which deliverable from §5 you want first.
- "wait on more" → tell me what's missing.
