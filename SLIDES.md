# Slide deck brief — "Exa for People Search"

Outline + design instructions, ready to paste into a design tool.
3 slides, 16:9, presented for ~5 minutes before a live app demo.
Audience: developers building a people-search product.

---

## Design system (from exa.ai — replicate faithfully)

**Logo (SVG, hosted on Exa's docs CDN — signed URLs, verified working;
a local copy also lives at `public/exa-logo-light.svg` in this repo):**
- Light backgrounds:
  `https://mintcdn.com/exa-52/rjfwhV9stZF3dXkq/logo/light.svg?fit=max&auto=format&n=rjfwhV9stZF3dXkq&q=85&s=23f6eeaafae25b4c8b6efb60ddc68e0c`
- Dark backgrounds:
  `https://mintcdn.com/exa-52/rjfwhV9stZF3dXkq/logo/dark.svg?fit=max&auto=format&n=rjfwhV9stZF3dXkq&q=85&s=977afb715a77c49036c8991b22bb82c7`
- (The marketing site renders the wordmark as inline SVG, viewBox `0 0 278 100`; the CDN files above are the downloadable assets.)

**Palette (pulled from exa.ai/products/deep):**
- Background: warm paper `#F1EFEB` (alt panels `#F2F0EF`, `#EFEDEB`)
- Hairlines / borders: `#E8E6E4`
- Ink (headlines): `#1F1B18`
- Body text: `#3F3B38`
- Muted text: `#9A958F` / `#7A7570`
- Accent blue (links, key numbers, diagram arrows): `#0035D0`
- Docs-brand blues if a secondary blue is needed: `#0765D9` / `#4B8BF4`

**Type (Exa's stack, with substitutes):**
- Display / slide titles: Arizona (serif) — substitute Georgia or another
  quiet transitional serif
- Body / UI: ABCDiatype — substitute Inter
- Code, API routes, numbers: GeistMono — substitute any mono

**Overall feel:** exa.ai is calm, paper-toned, editorial — serif display type,
generous whitespace, thin hairline boxes, tiny mono labels, one blue accent.
No gradients, no drop shadows, no rounded-corner card soup.

---

## Slide 1 — Title

- Exa logo (light.svg), small, top-left
- Title (serif, large): **Exa for People Search**
- Tagline under it (mono, small, muted): `Web search API for agents`
- Centerpiece — the customer quote, set large enough to read from the back:

  > "Exa is necessary for agents on HubSpot to supplement internal data with
  > high quality, real-time people and company search. We found that other
  > alternatives were slower, more expensive, and did not have comprehensive
  > enrichment coverage."
  >
  > — **Praty Sharma**, AI Lead, HubSpot

- Attribution line in mono; optionally the HubSpot logo, small and grayscale
- Design note: quote gets the room; nothing else competes on this slide

---

## Slide 2 — Why Exa for people search

- Title (serif): **Why Exa for people search**
- Subtitle (mono, muted): `what you're up against — and what maps to it`
- Two-column ledger table, hairline rules, no fills. Left column = the
  builder's pain (body ink), right column = the Exa answer (accent blue keys
  in mono where an API concept is named):

| Building people search | Exa |
|---|---|
| Contact databases are stale the day you buy them | Live index of the open web — signals (funding, job posts, talks), not snapshots |
| Users ask in sentences; keyword/boolean can't express intent | Neural search reads intent from one natural-language `query` string |
| People data arrives as HTML to parse | `category: "people"` returns structured entities: name, location, dated work history |
| Profile + evidence + contact = three vendors and a glue layer | One API: search → contents → research → agent, with partner data routed in a single run |
| Cost and latency blow up at product scale | Fractions of a cent per call, ~1s fast search, exact `costDollars` on every response |

- Design note: five rows max, one line each; let the table breathe

---

## Slide 3 — How Exa works

- Title (serif): **How Exa works**
- Subtitle (mono, muted): `Low-latency, token-efficient search`
- Main graphic: replicate Exa's "built a search engine from scratch"
  architecture diagram — left-to-right flow, thin hairline boxes, small mono
  captions, blue arrows:

  1. Far left: "The Web" with a scribbly link-graph motif
  2. Bracketed group labeled with the Exa logo containing three boxes:
     - **Massive-scale web crawling** — "crawl 3M URLs per hour"
     - **Embedding model** — "transformers trained for next-link prediction"
     - **Custom vector DB** — "extremely high-throughput, low-cost"
  3. Output column: **Search results** / **Contents**
  4. Far right: **Connect AI to the web** — "LLMs, agents, apps"
  5. A return arrow looping bottom-right back to the Exa group (the loop:
     agents call search again)

- One-line contrast beneath the diagram (body): *LLM weights froze at
  training time and guess at specifics — Exa retrieves current documents
  with URLs attached: current, verifiable, token-efficient.*
- Footer strip (mono, hairline-boxed): **Demoed today:** `/search` ·
  `/contents` · `deep` (research + structured output) · `/agent/runs` (+ Connect)
- Design note: this slide is the handoff — end on the footer strip and
  switch to the live app

---

## Speaker beats (not on slides)

1. Open on the HubSpot quote: faster, cheaper, better coverage — "the demo
   will substantiate all three with real calls and real prices on screen."
2. Slide 2: every row is *shown*, not asserted, in the next 15 minutes.
3. Slide 3: the moat matters to developers — first-party crawler, embedding
   model, and vector DB is where the latency/cost numbers come from. Land on
   the four routes, then switch to the app.
