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

**Live demo (~15 min).** Three beats, the request JSON always on screen
(hover any key for its docs):

1. **Search.** Query: *"Nvidia: Jensen Huang's direct reports."*
   Plain `/search` with `category: "people"` — one natural-language sentence
   in, structured people out: names, titles, locations, dated work history.
   No filters, no parsing.
2. **Agent, then deep.** Query: *"Revenue or sales leaders at companies that
   raised a Series B in the last 6 months and are rapidly scaling their
   go-to-market team."* The results look plausible — **Verify with Agent**
   hands the same rows to `/agent/runs` via `input.data` and returns verdicts
   with reasons. Then **Re-run as deep**: gpt-5-nano rewrites the query →
   deep search finds the companies web-wide → a parallel join finds one
   leader per company. Pause on the middle deep call's **Structured output**
   table — that's `outputSchema` on `/search`: schema in, cited entities out.
3. **One person, end to end.** Click a profile. The drawer's **Profile**
   section is `/contents` — the search result id goes straight in, extracted
   summary + page text come back (note the cached/crawled provenance pill).
   The **Brief** renders when its `/agent/runs` call finishes — this is
   **Exa Connect**: partner providers (Fiber.ai, Financial Datasets) attached
   explicitly, routed automatically, billed only when called; the email comes
   back verified from partner data or inferred from the open web, grounded
   either way.

**Narrative close (~5 min).** The app *is* the integration guide — fixtures
for demo determinism, client-side caching so nothing bills twice, honest
fallbacks, every request byte-visible. Success with Exa is knowing which
primitive answers which question; when retrieval fails, reach for a bigger
primitive, not a cleverer keyword.

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
