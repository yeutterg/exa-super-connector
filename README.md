# SuperConnector — Signal-Based Sales Intelligence (Exa Demo)

A demo applet for the Exa enterprise walkthrough. One persona: an AE selling
RevOps tooling to Series B SaaS. One thesis: **neural intent search +
auto-routed live research does what a keyword database can't.**

See `../PLAN.md` for the full demo plan, slides, and narrative script.

## Run

```bash
npm install
npm run dev
```

Works with **zero configuration** — the three hero queries are pre-cached
fixtures (synthetic, fictional people/companies) sitting in the sidebar, so the
app demos with no network and no API key.

## Go live

1. Put your key in `.env.local`:
   ```
   EXA_API_KEY=your-key
   ```
2. Regenerate the fixtures with real Exa responses:
   ```bash
   npm run fixtures
   ```
   Inspect the regenerated `lib/fixtures/hero-*.json` — pick queries whose
   result sets look good, and pre-warm the Build Brief for the one person
   you'll click on stage (see the note the script prints).
3. Any non-hero query typed in the search bar now fires a **live** Exa call
   (`/api/search`). Build Brief on a non-pre-warmed person fires a live
   **Agent run with Connect providers attached** (`/api/brief`).

If a live call fails mid-demo, the client silently falls back to the nearest
fixture — no visible failure on stage.

## Demo flow (~30 min)

**The customer.** A B2B sales team selling into Series B SaaS. Their problem:
the signals that make an account worth calling *right now* — funding, job
postings, migrations, exec talks — live scattered across the open web, not in
their CRM or contact database. Reps spend hours a day re-assembling that
context by hand.

**Slides (2–3, ~5 min).** Why signal-based prospecting beats list-based:
timing is the multiplier on outreach; databases go stale the day they're
exported; the open web is where the truth lives. One slide on the workflow
today (rep + 12 browser tabs) vs. the workflow with Exa (one query, verified
answer, receipts attached).

**Live demo (~15 min).** One continuous thread, each beat one click:

1. *Ask in plain English* — hero query, people search. Point at the request
   JSON: no filters, no booleans, `category: "people"`. Results carry
   structured work history natively (click a person → profile drawer).
2. *Catch it being wrong* — the results look right but aren't (existing
   RevOps leaders, not companies who haven't hired one). This is the honest
   beat: embedding search can only match what lives in the corpus. Run
   **Verify with Agent** — it researches each candidate and excludes the
   misses, with reasons.
3. *Fix it with a different tool, not a different phrasing* — **Re-run as
   deep**. Watch the pipeline narrate itself: gpt-5-nano rewrites the query →
   deep search decomposes it across the whole web with an `outputSchema` →
   findings come back as companies with citations → a parallel join runs one
   people search per company. Right people, one leader each, every call
   visible as code.
4. *From person to meeting* — **Build Brief**: one Agent run, Connect
   providers attached, router picks what it needs (Fiber for the profile,
   web inference when Fiber lacks the email), grounded "why now" signals, a
   ready-to-send opener.
5. *The receipt* — open the cost meter. Every call, real dollars. The whole
   thread cost less than a minute of an SDR's time.

**Narrative close (~5 min).** Exa isn't a database to query — it's search
primitives you compose: `/search` for intent, `/contents` for extraction,
deep + `outputSchema` for research, `/agent/runs` for verification and
enrichment. The demo's debugging arc *is* the pitch: when retrieval fails,
you reach for a bigger primitive, not a cleverer keyword. Websets is this
exact loop, productized.

## What maps to what

| App feature | Exa surface |
|---|---|
| Search bar / hero chips | `POST /search` — `category: "people"`, natural-language intent |
| Results table | `results[]` + `entities[].properties` (native structured people data) |
| Profile drawer (click a person) | `POST /contents` — ids from search, steered `summary`, cached/crawled provenance |
| Re-run as deep | gpt-5-nano rewrite → `type: "deep"` + `outputSchema` → parallel per-company join |
| Verify with Agent | `POST /agent/runs` — `input.data` rows, structured verdicts with reasons |
| Raw toggles | The exact response JSON everywhere — no transformation layer |
| Build Brief | `POST /agent/runs` — Connect (`fiber_ai`, `financial_datasets`) auto-routed + web research |
| Cost meter | `costDollars` from every response — searches, joins, briefs, contents |
| History sidebar | Cached sessions with permalinks (`/s/<id>`) — instant replay, zero network risk |

## Demo-day checklist

- [ ] `npm run fixtures` with a real key; sanity-check all three result sets
- [ ] Pre-warm the brief for the person you'll click (save as `lib/fixtures/brief-<id>.json`)
- [ ] Rehearse the one live wildcard query
- [ ] `npm run build && npm start` (prod mode — no dev overlay button)
