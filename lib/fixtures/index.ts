// Fixture registry. These ship as synthetic placeholder data (fictional people
// and companies) so the app demos with zero network dependency. Regenerate with
// real Exa responses via `npm run fixtures` once EXA_API_KEY is in .env.local.

import type {
  BriefRecord,
  ExaSearchResponse,
  SearchRecord,
} from "@/lib/types";
import { buildSearchBody, normalizePeople } from "@/lib/exa";

import hero1 from "./hero-1.json";
import hero2 from "./hero-2.json";
import hero3 from "./hero-3.json";
import briefTylerJohn from "./brief-tyler-john.json";

interface RawFixture {
  query: string;
  durationMs: number;
  response: ExaSearchResponse;
}

function toRecord(raw: RawFixture, index: number): SearchRecord {
  return {
    id: `fixture-${index + 1}`,
    query: raw.query,
    // Staggered "earlier this session" timestamps, assigned at seed time.
    createdAt: Date.now() - (3 - index) * 11 * 60 * 1000,
    source: "fixture",
    request: buildSearchBody(raw.query),
    response: raw.response,
    people: normalizePeople(raw.response),
    durationMs: raw.durationMs,
  };
}

export function seedSearches(): SearchRecord[] {
  return [hero1, hero2, hero3].map((raw, i) =>
    toRecord(raw as RawFixture, i),
  );
}

export const HERO_QUERIES = [hero1.query, hero2.query, hero3.query];

/** Pre-warmed briefs, keyed by person (result) id — guardrail #2. */
export const SEED_BRIEFS: Record<string, Omit<BriefRecord, "request">> = {
  [briefTylerJohn.personId]: briefTylerJohn as Omit<BriefRecord, "request">,
};

/** Nearest-fixture fallback for a failed live call (silent, per guardrail #5). */
export function fallbackFor(query: string): RawFixture {
  const q = query.toLowerCase();
  const scored = [hero1, hero2, hero3].map((f) => ({
    fixture: f as RawFixture,
    score: f.query
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3 && q.includes(w)).length,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].fixture;
}
