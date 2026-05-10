# Quantara: Hard Questions Before We Keep Building

Written 2026-05-10 in entrepreneur mode, not engineer mode. Stop coding for an hour and read this.

---

## The honest summary

Quantara today produces **a list of Walmart products with hyperlinks**. It dedupes across scans, drops Walmart house brands, gets ~28% UPC coverage. That's it.

The user's stated goal is **15%+ net margin Amazon arbitrage from Walmart sourcing**. The gap between "list of Walmart products" and "actionable arbitrage leads" is enormous. Every meaningful step — Amazon ASIN match, fee calc, sales velocity, profit estimate, IP-risk filter — happens manually in SAS, one product at a time.

If the master catalog is 2,800 products and SAS takes 30–60s per ASIN, that's **23–47 hours of manual review**. A full work-week. To find maybe 5–20 actual buys.

**The critical question we keep avoiding: at this hit rate and time cost, is this a viable income stream, or a hobby?**

---

## Questions an investor would ask, ranked by sharpness

### 1. What's the conversion funnel, in numbers?

We have hypotheses, no data. Real-world Amazon retail-arb funnels typically look like:

| Stage | Survival rate | From 2800 |
|---|---|---|
| Walmart products scraped | 100% | 2800 |
| Has UPC / matchable to Amazon ASIN | 60–80% | ~2000 |
| ASIN exists & not gated for our account | 50–70% | ~1100 |
| Amazon price ≥ Walmart × 1.30 (room for 15% net) | 5–15% | ~120 |
| BSR good enough to actually sell (~top 1–3% of category) | 30–50% | ~50 |
| Not a multipack/variant trap | 80% | ~40 |
| Amazon (1P) not on listing | 60% | ~25 |
| **Buyable** | | **~25** |

That's **a ~1% conversion rate** end-to-end. **Build the workflow assuming 99% of rows are noise.** Currently we don't filter or rank — we make the user wade through all 99%.

**Q:** Is there published data from arbitrage communities to anchor these numbers, or should we instrument the SAS workflow to measure our actual funnel? (The latter requires logging which products the user buys after SAS review.)

### 2. Why Walmart specifically? Why not the competition?

Online retail arbitrage is **saturated**. Tactical Arbitrage, OAGenius, SourceMogul, RevSeller, and dozens of paid tools all scrape Walmart for the same arb opportunities. Tens of thousands of sellers have run the exact same query the user is running now.

**Q:** What's our edge?
- Cheaper? (Free vs $50–200/mo — but we don't yet match feature parity.)
- Faster? (We're slower than paid tools because of pacing + no ASIN matching.)
- More complete? (Paid tools have proxies + Keepa integration + every retailer.)
- Better surfacing? (We don't even surface — we dump.)

The honest answer: **we have no edge yet.** The investment so far buys learning, not advantage. That's fine for a v1, but the question is when we acquire one.

**Q:** Is there a less-saturated source the user could pivot to?
- Big Lots, Marshalls, Burlington (in-store only — different workflow)
- Liquidation lots (B-Stock, BULQ — bulk auctions)
- Estate / garage sales (deep discounts, no scraper helps)
- Vendor wholesale (legitimate distributors with Amazon authorization)

A scraper-built tool can't help with offline sources. **Is the user really doing OA, or is "Walmart scraping" a comfortable substitute for harder work?**

### 3. What's the actual capital plan?

Arb without capital plan is gambling. Pre-buy questions:
- How much money is committed to Q1 inventory?
- Maximum ticket per product? (Typically $30–80 for OA — protects against duds.)
- Stop-loss when a product doesn't sell in N days?
- Reorder threshold when a product sells through?

**Q:** Does the user have a written buy plan, or is this "scan → see what's profitable → buy whatever I can"? The latter doesn't scale and doesn't compound.

### 4. Why 15% net margin, not 30%?

Industry minimum for retail arb is **30% ROI**. Targeting 15% is dangerous because:
- One return = wipes profit on 3–5 sales of the same item.
- One pricing dip on Amazon = wipes a month of margin.
- Long-tail items sit longer; storage fees compound.
- Q4 long-term storage fees alone can eat 10% per quarter.

15% net "after fees" sounds OK on paper, but real net (after returns, lost-shipment claims, refurb costs, storage, capital cost) is typically half of paper net. **15% paper margin probably means 5–8% real margin. Below break-even after time cost.**

**Q:** Is the user willing to raise the bar to 30% gross ROI minimum? That cuts the funnel further but kills bad bets early.

### 5. How does the user actually operate this tool?

Right now: open Excel, click each Walmart link, wait for SAS Quick to load, scan the SAS panel, decide buy/skip, repeat 2,800 times. **At 1 minute per row, that's 47 hours.** No rational human will do this.

Real-world workflow:
- Sort Excel by something (price? brand? availability?)
- Skim the first 50 rows
- Get bored, pick a few candidates randomly
- 90% of catalog never gets reviewed
- Find 3–5 buys, declare victory

**Q:** What ranking heuristic — even rough — would get the user to review the right 50 rows instead of a random 50? Without an Amazon-side data feed, we can only sort by:
- Price (sub-$5 = skip; $20–50 = sweet spot)
- Brand presence on Walmart (no-name = lower IP risk)
- Title-keyword whitelist (specific generics that arbitrage well)

Building a "rough ranking" would cut review time 10×. We haven't done it.

### 6. Where does the data go after SAS confirms a winner?

Currently: nowhere. The user has to manually track:
- Which SKUs they bought
- How much they paid
- When they shipped to FBA
- What sold, at what price
- ROI realized vs ROI predicted

**Q:** Do we build a tiny portfolio-tracking layer (`buys` table + a "log my buy" endpoint), or assume the user uses InventoryLab / SoStocked / spreadsheet?

Without this, we can't measure prediction accuracy. We'll keep guessing what's a "good" lead because we never see whether a buy paid off.

### 7. What about price changes between scan and buy?

We snapshot Walmart prices at scan time. By the time the user reviews and decides to buy, prices may have shifted (Walmart promo expired, item went OOS, MAP adjustment).

**Q:** Should the workbook indicate "snapshot is N hours old"? Should we re-fetch price at SAS-review time? Or just accept that arb leads have a short shelf-life and run scans daily?

### 8. Walmart receipt is not an authorized invoice

If a brand owner files an IP claim on Amazon, the seller must produce a wholesale invoice from an **authorized distributor**. A Walmart receipt does not qualify. Result: account-health hit, possible suspension, lost capital.

**Q:** Is the user OK with this risk? Most retail arbitragers operate in a grey zone where IP claims are rare but ruinous. We don't currently surface "this brand has filed N IP claims in the last quarter" — and that data doesn't really exist publicly.

**Mitigation we could build:** a brand-risk score based on whether the brand is in Brand Registry / Project Zero / Transparency. Imperfect proxy, but better than nothing.

### 9. Does Quantara save time, or just shift it?

A user manually browsing walmart.com + opening interesting-looking products + checking SAS would probably find the same 5–20 winners in 4–6 hours. We deliver them a 47-hour spreadsheet.

**Q:** Where's the time savings? Concrete answer needed before we build more features.

---

## What an entrepreneur would build next, in order

Given the questions above, here's the priority I'd defend in a pitch:

### Tier 1 — Make the workbook actionable (this week)
1. **Rough rank in workbook.** Even without Amazon data, sort by:
   `score = price ∈ [$10, $50] AND has_upc AND title_keywords_whitelist AND not_premium_brand`
   Goal: top 100 rows are 5–10× more likely to convert than random.
2. **Drop sub-$5 rows** by default (they're noise — barely break even after fees).
3. **Mark "no-name brand" vs "branded".** No-name = lower IP risk, often arbitrage-friendly.
4. **Stale-data warning.** Show how old the Walmart price is per row.

### Tier 2 — Get rough Amazon side data (next 2 weeks)
5. **Keepa API integration** ($20/mo). Adds Amazon price, BSR, sales count, FBA fees per ASIN.
6. **ASIN matching by UPC.** UPC → Amazon search → ASIN. Use Keepa's UPC-to-ASIN endpoint.
7. **Pre-calculate ROI** in workbook. (Walmart price + $5 prep+ship) vs (Amazon price - 15% referral - $4 FBA pick/pack). Drop rows below 30% ROI.
8. **Velocity check.** BSR → estimated monthly sales (per-category formula). Drop rows that sell <3/month.

This should get the user from 47-hour reviews down to **5–10 hand-picked rows per scan**. That's the real product.

### Tier 3 — Close the loop (next month)
9. **Buy-tracking endpoint.** `POST /api/buys` with SKU, qty, cost. Builds a portfolio over time.
10. **Sold-through reconciliation.** Daily fetch from Amazon orders → match to buys → realized ROI.
11. **Repeat-buy alerts.** When a tracked SKU hits a Walmart deal again, surface it.
12. **Brand IP-risk score.** Public brand-registry data + crowd-sourced "brand X is litigious" flags.

### Tier 4 — Differentiation (3+ months)
13. **Walmart Affiliate API** application (replaces Puppeteer, gives us 100% UPC + reliability).
14. **Multi-source scanning** (Target, Home Depot, Lowe's, Big Lots online).
15. **Lead-scoring model** trained on the user's actual buys vs. predicted profit.

---

## The real choice points for the user

These are the calls only they can make:

1. **Time investment to viability.** Realistically, this is 1–3 months of building before it produces profitable buys at $X/month run-rate. Are you investing that time, or do you need cash flow now?

2. **Capital deployed for testing.** To validate that the funnel even produces winners, you need to run ~$2k–5k through the system over 60–90 days. Without that, we're optimizing a tool that may have no economic basis.

3. **Tool-build vs tool-buy.** Tactical Arbitrage costs ~$60/month and does 90% of what Tier 2 would build. We build because we want customization, not because we save money. Is custom worth 1–3 months of build time?

4. **Volume strategy.** OA at 30% ROI on 50 SKUs/month = ~$1500–3000 net. That's a part-time income, not a business. To scale to a real business, the answer is usually wholesale + private label, not more arb scanning.

5. **Account safety vs. growth tradeoff.** Aggressive sourcing (any open ASIN, any condition) maximizes leads but increases IP-claim risk. Conservative sourcing (no-name brands only) reduces risk but may starve the funnel. Pick a posture.

---

## What I'd recommend if you said "you call it"

1. **Pause new feature work for 1 week.** Run the current Quantara as-is. Use it for actual sourcing. Buy 10 products. **Track every step:** time to review, ASIN match success rate, SAS-confirmed leads, actual buys, sell-through. This data informs every Tier 2 decision below.

2. **After 1 week, decide:** does the funnel even produce profitable buys? If yes, build Tier 1 (this is small — a day of work). If no, pivot — maybe the real problem is sourcing-channel, not tool-quality.

3. **Skip Keepa until step 2 confirms there's a real funnel.** Adding $20/mo + a week of build time before validating the basic premise is premature.

4. **Don't build Tier 3 (buy tracking) until Tier 2 (lead pre-filtering) is in place and shipping.** Each tier earns the right to the next.

5. **Be honest about whether OA is the right business.** If 1 month of effort produces $300, the unit economics don't compound. Wholesale + private-label start slower but build durable margin.

---

## My one-sentence honest take

> Quantara today is a competent crawler and a half-built sourcing tool. It saves the user no time on the most expensive step (per-ASIN profit analysis) and competes with established paid tools that already do that step well. Building the rough-rank workbook + Keepa integration + ROI estimator is the minimum viable next step; everything else is premature.

If we agree on that, the next 2 weeks of work plan themselves. If we don't, we should talk before more code lands.
