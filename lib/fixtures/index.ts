// Fixture registry — the "light always lights up" layer. Every demo beat has
// a recorded real Exa response behind it, so the full walkthrough works with
// no network and no API key:
//   beat 1  nvidia.json           (plain /search replay)
//   beat 2  hero-1..3.json        (search replays)
//           verify-hero-1.json    (agent verify replay for the hero turn)
//           deep-pipeline-hero-1  (rewrite + deep + joins, used if live fails)
//   beat 3  contents-tyler-john   (profile drawer, pre-seeded)
//           brief-tyler-john      (agent + Connect brief, pre-seeded)
// Regenerate with real Exa responses via `npm run fixtures` once EXA_API_KEY
// is in .env.local.

import type {
  BriefRecord,
  ContentsRecord,
  ExaSearchResponse,
  SearchRecord,
  SearchRequestBody,
  VerifyRecord,
} from "@/lib/types";
import { buildSearchBody, normalizePeople } from "@/lib/exa";

import hero1 from "./hero-1.json";
import hero2 from "./hero-2.json";
import hero3 from "./hero-3.json";
import nvidia from "./nvidia.json";
import briefTylerJohn from "./brief-tyler-john.json";
import contentsTylerJohn from "./contents-tyler-john.json";
import verifyHero1 from "./verify-hero-1.json";
import deepPipelineHero1 from "./deep-pipeline-hero-1.json";

interface RawFixture {
  query: string;
  durationMs: number;
  response: ExaSearchResponse;
}

const SEARCH_FIXTURES = [hero1, hero2, hero3, nvidia] as RawFixture[];

function toRecord(raw: RawFixture, index: number): SearchRecord {
  return {
    id: `fixture-${index + 1}`,
    query: raw.query,
    // Staggered "earlier this session" timestamps, assigned at seed time.
    createdAt: Date.now() - (SEARCH_FIXTURES.length - index) * 11 * 60 * 1000,
    source: "fixture",
    request: buildSearchBody(raw.query),
    response: raw.response,
    people: normalizePeople(raw.response),
    durationMs: raw.durationMs,
  };
}

export function seedSearches(): SearchRecord[] {
  return SEARCH_FIXTURES.map((raw, i) => toRecord(raw, i));
}

/** Queries that replay a recorded fixture instead of calling live. */
export const HERO_QUERIES = SEARCH_FIXTURES.map((f) => f.query);

/** Pre-warmed briefs, keyed by person (result) id — guardrail #2. */
export const SEED_BRIEFS: Record<string, Omit<BriefRecord, "request">> = {
  [briefTylerJohn.personId]: briefTylerJohn as Omit<BriefRecord, "request">,
};

/** Pre-warmed /contents extraction — the profile drawer opens instantly (and
 *  offline) for the person the demo clicks. */
export const SEED_CONTENTS: Record<string, ContentsRecord> = {
  [contentsTylerJohn.personId]: contentsTylerJohn as ContentsRecord,
};

/** Recorded agent-verify run for the fixture-1 turn — clicking Verify on the
 *  hero turn replays this deterministically instead of a 60s live run. */
export const SEED_VERIFY: Record<string, VerifyRecord> = {
  [verifyHero1.searchId]: verifyHero1 as VerifyRecord,
};

/** Full recorded deep pipeline (rewrite + deep + per-company joins) for the
 *  hero query — the silent fallback if the live pipeline fails on stage. */
export interface DeepPipelineFixture {
  query: string;
  rewritten: string;
  rewriteRequest?: object;
  deep: { request: SearchRequestBody; response: ExaSearchResponse; durationMs: number };
  joins: {
    company: string;
    request: SearchRequestBody;
    response: ExaSearchResponse;
    durationMs: number;
  }[];
}
export const DEEP_PIPELINE_FALLBACK = deepPipelineHero1 as DeepPipelineFixture;

/** Nearest-fixture fallback for a failed live call (silent, per guardrail #5). */
export function fallbackFor(query: string): RawFixture {
  const q = query.toLowerCase();
  const scored = SEARCH_FIXTURES.map((f) => ({
    fixture: f,
    score: f.query
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3 && q.includes(w)).length,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].fixture;
}
