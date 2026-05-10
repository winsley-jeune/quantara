# Live observations during full-catalog scan d59234d5

Started 2026-05-10 01:48 UTC. Updated as I see things.

## Feed-by-feed log

| # | Feed | Items | UPC | Notes |
|---|---|---|---|---|
| 1 | dog rope toy | 56 | 0 | First PDP blocked — Walmart still flagging from earlier. All saved category-only. Cooldown bumped to 120s. |
| 2 | cat scratching post | 58 | some | First PDP blocked but several earlier items got UPC before halt. Cooldown 240s. |
| 3 | aquarium decor | 51 | some | Same pattern. Cooldown 480s. |
| 4 | bird cage accessories | 55 | some | Same pattern. Cooldown 600s (capped). |
| 5–7 | reptile heat lamp / desk organizer / label maker | ~55 each | mixed | All hit 600s cooldown. Master catalog at 327 products / 86 UPCs. |

**Restart at 02:45 UTC** — killed scan d59234d5 mid-flight after 7 feeds. Zombie cleanup correctly marked it failed. Re-launched as 04e4609b-3774-4107-9587-85551946e17c with: auto-degrade to category-only, cooldown cap lowered to 5 min, cancel endpoint, drop-priceless filter. Master catalog preserved across restart at 383 products / 86 UPCs.

## Live pattern observed
**PDP traffic is uniformly blocked while category pages work.** Feeds 1, 2,
3 all got 50–58 items via category scrape, then hit "Robot or human?"
on the very first PDP. Walmart's anti-bot is selective: search/category
endpoints have cooler tolerance, individual `/ip/<id>` PDPs are flagged.

**Implication:** The 50%-rate-budget directive is not the issue here —
Walmart has us in PDP-cooldown specifically. Doubling cooldown timers
won't lift the flag in the same scan.

**Action:** Auto-degrade to category-only mode when consecutive feeds
fail at PDP step 1. We still get full category coverage; UPC fills in
on a future scan once IP recovers.

## Improvements identified

### #1 — Auto-recover zombie "running" scans on server start (HIGH)
**Problem:** When tsx watch (or any restart) kills the server mid-scan, the
DB still shows the scan as `running`. The 409 guard then refuses any new
scan until you manually `UPDATE scans SET status='failed'`. This bit us
today.
**Fix:** In `db.connect()`, on first connect, mark any `running` scans as
`failed` with a clear `errorMessage` ("orphaned by server restart").

### #2 — POST /api/scans/:id/cancel endpoint (MED)
**Problem:** No clean way to stop a misbehaving scan. We've had to
manually kill processes and `UPDATE` the DB twice.
**Fix:** Cooperative cancellation — set a flag on the scan record, runner
checks it between feeds, marks the scan as `cancelled` (new status) and
keeps whatever products it had.

### #3 — Drop products without price from workbook (MED)
**Problem:** Arbitrage needs a price; rows with `price.amount = null` are
noise in the SAS workflow.
**Fix:** Filter in `excelWriter` (UI concern, not data concern — keep raw
data in DB).

### #4 — Configurable minimum price (LOW)
**Problem:** Sub-$3 items rarely net $3+ profit after FBA fees, but
they pad the workbook and dilute scanning attention.
**Fix:** Add `MIN_PRICE` env var, default $3. Filter in workbook builder.

### #5 — Track which category each product came from (MED)
**Problem:** Master workbook has no signal for whether a product came
from "office" or "pet" or "tools". User can't filter by category.
**Fix:** Thread the category key through scanRunner → product → DB.
Adds a column to the master catalog and per-scan workbooks.

