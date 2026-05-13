# LinkedIn post drafts — Quantara

Two versions. Pick one, edit, paste into LinkedIn. Both deliberately frame
the work as "robust async systems engineering" rather than "scraper" — much
better recruiter response.

---

## Version A — engineering depth, conversational

> Spent the last two weeks building a real lesson in **engineering for the long tail of failure**.
>
> The system: a TypeScript + Express service that walks a curated list of category endpoints, normalizes structured product data, and produces a deduplicated catalog persisted in SQLite. Simple on paper.
>
> The reality: every request lives in a hostile environment — rate limits that shift hour to hour, bot challenges that fire on the second request after twenty clean ones, browser fingerprinting that flags processes by the page they just rendered. "Just scrape it" turns into a 5-layer state machine the moment you want it to run unattended overnight.
>
> What ended up mattering wasn't the scraping. It was:
>
> – **Adaptive backoff** that doubles cooldowns on a block and halves them on a clean feed, so the system stays under the rate budget without me babysitting it
> – **Fingerprint rotation** by recycling the headless browser every N pages — clears flagged cookies, resets the TLS handshake
> – **Per-feed checkpointing** so a crash at feed 35 of 54 doesn't throw away the 1,700 products already collected
> – **Zombie recovery** at the data layer: any scan still marked `running` on server start gets auto-marked failed, because the worst kind of stuck state is the kind a 409 guard refuses to let you out of
> – **Auto-degrade**: when 3 consecutive feeds drop under a UPC-yield threshold, the rest of the scan switches to a faster category-only path. The system makes the tradeoff itself, I don't sit and watch it.
>
> The whole thing is ~1500 lines of TypeScript with strict typecheck, 9 deterministic unit tests, and zero external services beyond the headless browser and SQLite. Express MVC for the API surface, `tsx watch` for dev, `node:test` for tests — no framework lock-in, no infra beyond `npm run dev`.
>
> Most interesting lesson: the cheap pre-filter beats the smart pre-filter. Adding a one-line `Score` column derived from existing fields (UPC presence, price band, brand presence) cut the user's review queue 10× before I even started thinking about ML.
>
> Open to roles where the hardest problem is "make it work reliably when the world fights back." Pinging recruiters in the comments.
>
> #TypeScript #BackendEngineering #SystemDesign #Node #Puppeteer

---

## Version B — punchier, hook-led

> A scraper is easy. A scraper that runs for 8 hours unattended without your phone going off — that's where the engineering lives.
>
> Two weeks ago I started building one. Twelve commits later, what I shipped wasn't really a scraper at all. It was:
>
> – An adaptive backoff loop that doubles its own cooldown when blocked and halves it when clean
> – A browser fingerprint recycler that swaps identity every 15 page loads
> – A checkpointing pipeline that survives mid-run crashes with zero lost data
> – A zombie-state cleaner so a killed process never leaves the system stuck
> – An auto-degrade path that gives up on the slow strategy when the fast one is being denied
> – Cooperative cancellation, per-request rate-limit budgeting, deduplicated cross-run state
>
> Stack: TypeScript, Express MVC, better-sqlite3, Puppeteer-Extra with stealth, ExcelJS for output, native node:test for the test layer. ~1500 LOC. No external services. Runs on a laptop. Recovers from its own crashes.
>
> The lesson I'll take to the next thing: **engineering is mostly designing for the failure modes you haven't seen yet**. Every robustness feature on the list above was a reaction to a specific 2am surprise during the build.
>
> Looking for backend / systems / platform roles where this kind of work shows up daily.
>
> #TypeScript #SoftwareEngineering #BackendDev #DistributedSystems #OpenToWork

---

## Tweaks worth considering before posting

- **Add a screenshot.** A picture of the Top-50 sheet with the green/yellow Score highlights would be eye-catching. LinkedIn images get ~2× engagement vs text-only.
- **Drop a public repo link** if you make it public. Even if the README is light, recruiters do click through.
- **Comment seed.** Reply to your own post within an hour with "Specific deep-dive on adaptive backoff: [link to a blog/Gist]" — boosts visibility.
- **First two lines are the hook.** LinkedIn truncates at ~210 chars before "see more." Make sure the most interesting claim is in line 1-2.
- **Don't say "looking for work" too explicitly.** "Open to roles" reads better than "I'm available." The hashtag #OpenToWork does the heavy lifting.
