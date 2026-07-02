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

## What maps to what

| App feature | Exa surface |
|---|---|
| Search bar / hero chips | `POST /search` — `category: "people"`, natural-language intent |
| Results table | `results[]` + `entities[].properties` (native structured people data) |
| Raw toggle | The exact response JSON — no transformation layer |
| Build Brief | `POST /agent/runs` — Connect (`fiber_ai`, `financial_datasets`) auto-routed + web research |
| Cost meter | `costDollars` from every response, per-source attribution on hover |
| History sidebar | Cached searches — instant replay, zero network risk |

## Demo-day checklist

- [ ] `npm run fixtures` with a real key; sanity-check all three result sets
- [ ] Pre-warm the brief for the person you'll click (save as `lib/fixtures/brief-<id>.json`)
- [ ] Rehearse the one live wildcard query
- [ ] `npm run build && npm start` (prod mode — no dev overlay button)
