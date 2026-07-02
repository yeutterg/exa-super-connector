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

**The customer.** A developer team building people search into their product —
sales intelligence, recruiting, GTM tooling. Their end users ask questions in
plain language ("sales leaders at Series B companies hiring their first RevOps
role"); the devs have to turn that into correct, current, affordable results.
Building this on raw web data means learning four hard lessons the slow way:
corpora have edges, embeddings can't negate, cross-corpus questions need
joins, and enrichment needs verification. This applet is a **teaching demo**:
every screen shows the exact API call and the exact response, and the demo
walks each failure mode next to the primitive that fixes it.

**Slides (2–3, ~5 min).** One: what devs actually hit building people search
(the four lessons above — each one a support ticket you won't file). Two: the
Exa primitive map — `/search`, `/contents`, deep + `outputSchema`,
`/agent/runs` + Connect — and which lesson each solves. Optional three: the
cost/latency envelope (fast search $0.005/1.5s → deep pipeline ~$0.05/15s →
agent run ~$0.20/60s), because devs will ask.

**Live demo (~15 min).** One continuous thread; every beat is one click, and
the request JSON is always on screen (hover any key for its docs):

1. *One parameter gets you people* — `category: "people"` on `/search` returns
   structured entities: name, location, full dated work history. No parsing,
   no scraping. Click a person: the drawer's Brief + Profile show
   `/agent/runs` and `/contents` composing off the same result id.
2. *The corpus lesson, live* — the results look right but aren't (existing
   RevOps leaders, not companies who haven't hired one). Embedding search can
   only match what lives in the corpus, and can't encode "not". **Verify with
   Agent** hands the same rows to `/agent/runs` via `input.data` and gets
   verdicts with reasons.
3. *Escalate the primitive, not the phrasing* — **Re-run as deep**. The
   pipeline narrates itself: gpt-5-nano rewrites the query (that call is
   shown too) → deep search + `outputSchema` finds the companies with
   citations → a parallel join runs one people search per company. Includes
   the blended-query pitfall: one query across five companies embeds as an
   average and drifts; five focused queries don't.
4. *Enrichment with receipts* — **Build Brief** in the drawer: Connect
   providers attached explicitly, routed automatically, billed only when
   called. Includes the schema pitfall we hit ourselves: describing the email
   field as "from Fiber.ai" made the agent return null instead of falling
   back to web inference.
5. *Patterns they'll copy* — "10 more profiles" shows the exclusion pattern
   (`/search` has no exclusion param: over-fetch + filter by id, list shown
   in the UI); the cost meter shows every call in real dollars.

**Narrative close (~5 min).** The app *is* the integration guide — fixtures
for demo determinism, client-side caching so nothing bills twice, honest
fallbacks, every request byte-visible. Success with Exa is knowing which
primitive answers which question; when retrieval fails, reach for a bigger
primitive, not a cleverer keyword. And when a customer wants this whole
search → verify → enrich loop off the shelf: that's Websets.

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
