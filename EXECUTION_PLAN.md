# Execution Plan — Pump Seal + HVAC Controls E-Commerce Launch (2-Week Sprint)

Owner: solo developer (user) + AI agent (Claude/Quantara) on parallel tracks.
Goal: ~20K SKU catalog (HVAC controls + mechanical pump seals) + multiple authorized manufacturer relationships + production-ready storefront within 14 days.

## Parallel tracks

```
TRACK A — USER builds storefront                    TRACK B — AGENT scrapes + outreaches
─────────────────────────────                       ──────────────────────────────────────
Week 1                                              Week 1
- Site stack (Next.js + DB schema)                  - Scrape 20K SKUs with search intent
- API endpoints (catalog, search, checkout)         - Excel deliverable ready for ingestion
- Storefront UI (product pages, cross-ref pages)    - Identify manufacturers per SKU
                                                    - Classify application paths

Week 2                                              Week 2
- Catalog ingestion from Excel/API                  - Send pitches to ~30-50 manufacturers
- SEO meta + JSON-LD per product page               - Track responses, parse pricing
- Search Console submission                         - Hand qualified pricing to Track A
- Go live                                           - Continue outreach loop
```

---

## Agent pipeline — 5 stages

### Stage 1 — SKU sourcing
**Input:** empty
**Output:** Excel sheet, 20K rows

Scrape sources:
- **Pump seals:** U.S. Seal Pump Cross-Reference PDF, Vulcan Seals coding system, BoilerSupplies, SupplyHouse, Inline Sales B&G cross-references, sealsales.com catalog, ppcmechanicalseals.com
- **HVAC controls:** Belimo catalog, Honeywell Building Tech catalog, ACI distributor catalogs, hvacusa.com, blackhawksupply.com, alpscontrols.com
- **Search-intent data:** Google Keyword Planner (free with Ads acct) OR Ahrefs/SEMrush export OR Ubersuggest free tier as fallback

Excel schema (also = DB schema):
```
oem_brand            (Bell & Gossett, Goulds, Belimo, Honeywell, ...)
oem_part_number      (186094LF, 3196 MT, LMB24-3-T N4, ...)
oem_model            (Series 80, 3196i, ...)
category             (HVAC controls / pump seals / o-rings / ...)
sub_category         (actuators / sensors / cartridge seals / ...)
equivalent_aftermarket_brand   (U.S. Seal, Vulcan, AST, PPC, ...)
equivalent_part_number          (USS-1234, V-5678, ...)
manufacturer_for_sourcing       (which manufacturer we'll pitch)
list_price_estimate
target_retail_price
search_query                    (e.g. "B&G 186094LF seal kit")
monthly_search_volume
top_3_competing_urls
ticket_size_estimate
status                          (sourced / pending_auth / authorized / listed / live)
```

### Stage 2 — Manufacturer resolution

Per SKU, identify the aftermarket manufacturer and classify their application path:

| Application path | Examples | Automation |
|---|---|---|
| `form_public` | Vulcan Seals, U.S. Seal Mfg | Puppeteer fills + submits |
| `email_direct` | Blackhawk Supply, HVAC USA | Agent drafts + sends email |
| `phone_required` | AST Seals, SEPCO, PPC | Agent prepares call script, flags human action |
| `multi_step` | Trane Supply, Kele | Agent prepares paperwork, flags human action |

Output: per-manufacturer application plan with all SKUs grouped under it.

### Stage 3 — Outreach execution

For each manufacturer:
- Generate custom **1-page pitch** using template from `MANUFACTURER_DIRECT_SOURCING.md`
- Include manufacturer-specific SKU exhibit (which of their SKUs we want to source)
- Include search volume data as demand justification
- Email path: send via Resend (or SendGrid)
- Form path: Puppeteer fills + submits
- Phone path: generate script, queue for user

DB status tracking:
```
queued → sent → auto_reply → human_reply → qualified → priced → authorized
```

### Stage 4 — Response parsing

- Inbound via Resend webhook (or IMAP polling)
- Claude classifies: `interested | needs_info | rejected | auto_reply | spam`
- Extracts structured info: pricing tier, payment terms, MOQ, next steps
- Surfaces qualified responses for user review

### Stage 5 — Pricing catalog ingestion

- When manufacturer sends price list (PDF / Excel / CSV)
- Claude extracts structured rows → merges with SKU records
- Fills in `wholesale_price`, calculates `target_retail_price` based on target margin
- Marks SKU as `listed` — ready for storefront API ingestion

---

## Stack

**Reuse from Quantara:**
- TypeScript + Express MVC
- better-sqlite3 (or upgrade to Postgres if you prefer for production)
- Puppeteer-stealth (already battle-tested via the Walmart scanner)
- Existing testing/build infrastructure

**Add:**
- Anthropic SDK (already have `ANTHROPIC_API_KEY`) for all LLM tasks
- Resend (free 3K emails/mo) for outbound; webhooks for inbound parsing
- exceljs (already a dependency) for Excel deliverable

**Match user's storefront stack:**
- DB schema designed up-front so Excel exports → API ingestion is one mapping
- Optional: shared Postgres / shared schema if you go full-stack TS

---

## Open decisions (block agent build start)

1. **Storefront stack.** Next.js? CMS? Custom Postgres? → I match DB schema accordingly.
2. **Sending domain.** Fresh domain for the new venture? Existing? → Affects credibility + DNS setup for Resend.
3. **Send autonomy.** Auto-send Vulcan + U.S. Seal forms (low-risk public forms), queue rest for approval? Or queue everything?
4. **Source priority.** Pump seals first then HVAC, or both in parallel?
5. **Search intent source.** Ahrefs/SEMrush access? Or use Google Keyword Planner + scraped autocomplete fallback?
6. **Budget.** Resend free tier covers everything; no other paid tools needed unless we add Ahrefs/SEMrush.

---

## Weekly milestones

### Week 1
- **Mon-Tue:** SKU scrape running, Excel partial output (5-10K rows)
- **Wed:** Storefront DB schema locked, API contract agreed
- **Thu:** SKU Excel complete + manufacturer resolution done; first 5-10 manufacturer pitches drafted for review
- **Fri:** First pitches sent (Vulcan + U.S. Seal public forms + 3-5 email pitches)

### Week 2
- **Mon-Tue:** Storefront ingestion + product page generation from Excel/DB
- **Wed:** Cross-reference pages live; sitemap submitted
- **Thu:** First manufacturer responses arrive, parsed, priced; SKU records updated
- **Fri:** Site goes live with first batch of priced SKUs; outreach loop continues

---

## Success criteria (end of Day 14)

- ✅ 20K SKUs scraped + scored by search intent
- ✅ ~30-50 manufacturer outreaches sent
- ✅ ≥3 qualified manufacturer responses with pricing
- ✅ Storefront live with ≥500 SKUs ranking-ready
- ✅ Cross-reference pages indexed in Google Search Console
- ❌ Revenue not expected yet (SEO indexing takes 4-12 weeks)

## Risk register

| Risk | Mitigation |
|---|---|
| Manufacturer cross-ref PDFs are noisy / inconsistent | Claude normalizes during scrape; manual spot-check 5% sample |
| Email outreach lands in spam | Resend handles DKIM/SPF/DMARC; warm up domain over week 1 |
| Manufacturers slow to respond | Parallel: send 30-50 pitches expecting 30% qualified response = 10-15 active conversations |
| Search-intent data inaccurate | Use Google Keyword Planner direct from Ads acct as ground truth; competitor SERP scraping as cross-check |
| Storefront not ready when first SKUs are priced | Excel-to-CSV import as fallback; don't block on full API |
| MAP enforcement clauses in distributor agreements | Read every dealer agreement carefully; surface MAP terms during response parsing |

---

## Files on the branch

- `INDUSTRIAL_SEO_NICHES.md` — niche selection (pump seals = winner)
- `DEMAND_ANALYSIS.md` — data justifying pump seals over restaurant parts
- `SOURCING_PLAYBOOK.md` — full distributor onboarding for 3 niches
- `MANUFACTURER_DIRECT_SOURCING.md` — tier-1 manufacturer-direct path (the playbook this plan executes)
- `STRATEGY.md` — entrepreneur-level questions
- `EXECUTION_PLAN.md` — this file (the 2-week sprint)
