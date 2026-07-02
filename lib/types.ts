// Shared types across API routes, fixtures, and UI.

export interface WorkEntry {
  title: string;
  location?: string | null;
  dates: { from: string | null; to: string | null } | null; // to: null = current role
  company: { id: string | null; name: string };
}

export interface EducationEntry {
  degree?: string | null;
  dates?: { from: string | null; to: string | null } | null;
  institution: { id: string | null; name: string };
}

/** One entity attached to an Exa people-search result. */
export interface ExaEntity {
  type: string;
  properties: {
    name: string | null;
    location: string | null;
    workHistory: WorkEntry[];
    educationHistory: EducationEntry[];
  };
}

/** One raw result from Exa /search with category: "people". Exa omits
 *  `favicon` on person results (no company favicon to attach), so it's
 *  optional here even though the UI treats it as nullable. */
export interface ExaSearchResult {
  id: string;
  url: string;
  title: string;
  image?: string | null;
  favicon?: string | null;
  publishedDate?: string | null;
  highlights?: string[];
  /** Present on people-category results; absent on web/news/company results. */
  entities?: ExaEntity[];
}

export interface CostDollars {
  total: number;
  search?: Record<string, number>; // e.g. { neural: 0.007 }
}

/** One extracted entity from a deep-search structured synthesis. */
export interface ExtractionFinding {
  entity: string;
  evidence: string; // citation URL
  note?: string;
}

/** Raw-ish Exa /search response body (what the Raw toggle shows). */
export interface ExaSearchResponse {
  requestId: string;
  resolvedSearchType?: string;
  results: ExaSearchResult[];
  /** Exa-reported search time in ms — distinct from our round-trip. */
  searchTime?: number;
  costDollars: CostDollars;
  /** Structured synthesis when the request carried an outputSchema (deep
   *  modes) — the schema-conforming object lives at output.content. */
  output?: { content?: { findings?: ExtractionFinding[] } };
}

/** Normalized person row derived from a search result. */
export interface Person {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string | null;
  image: string | null;
  favicon: string | null;
  url: string;
  /** First highlight — shown truncated in the table row. */
  highlight: string | null;
  /** All highlights (often markdown — headers, bold, links) for the expand view. */
  highlights: string[];
}

/** The POST body sent to api.exa.ai — shown verbatim in the JSON inspector tab.
 *  Category/dates/outputSchema vary with the re-run debugging options; every
 *  field here is a documented /search parameter. */
export interface SearchRequestBody {
  query: string;
  type: string;
  category?: string;
  numResults: number;
  systemPrompt?: string;
  startPublishedDate?: string;
  contents?: { highlights: { query: string } };
  outputSchema?: object;
}

/** The debugging knobs exposed in the Re-run modal — each maps 1:1 to a
 *  documented /search parameter, so the workflow generalizes to any query. */
export interface RerunOptions {
  /** instant/fast/auto are single-pass; deep* modes decompose and reason. */
  type: "fast" | "auto" | "deep-lite" | "deep";
  /** Which corpus to search; null = the entire web. The core lesson: the
   *  constraint must live in the corpus you search. */
  category: "people" | "company" | "news" | null;
  /** ISO date floor — only supported off the people/company categories. */
  startPublishedDate?: string;
  numResults: number;
  /** Attach a generic entity-extraction outputSchema (deep modes only). */
  extractEntities: boolean;
}

/** One search turn within a session. */
export interface SearchRecord {
  id: string;
  query: string;
  createdAt: number;
  source: "fixture" | "live";
  request: SearchRequestBody;
  response: ExaSearchResponse;
  people: Person[];
  durationMs: number;
  /** What the user actually typed, if a follow-up like "3 more people" was
   *  expanded (via GPT-5 nano) into a standalone query before it hit Exa. */
  rawInput?: string;
  /** Already-shown profiles excluded from this turn — applied CLIENT-SIDE by
   *  result id, because /search has no exclusion parameter and embedding
   *  queries can't reliably encode "not these people". The request over-
   *  fetches by this list's length to compensate; the UI renders this list
   *  next to the request code so the numResults math is visible. */
  exclusion?: { id: string; name: string; company: string }[];
  /** How many fetched results were actually dropped as already-shown. */
  excludedHits?: number;
  /** Deep re-runs are a two-step pipeline: deep web-wide extraction finds the
   *  companies (this record's request/response), then a fan-out join — ONE
   *  people search per company, in parallel — fills `people` with one leader
   *  each. These are those calls' bodies (first one shown as code, tag notes
   *  the fan-out count). */
  joinRequests?: SearchRequestBody[];
  /** Legacy single blended join (older persisted records) — still rendered. */
  joinRequest?: SearchRequestBody;
  /** The OpenAI chat.completions body (gpt-5-nano) that rewrote the query
   *  into deep-search format — shown as its own code block above the deep
   *  call so every step of the pipeline is inspectable. */
  rewriteRequest?: object;
  /** Whole-turn cost when the turn made multiple calls (deep + join fan-out).
   *  response.costDollars stays untouched (Raw view shows the real body);
   *  the cost pill uses this when present. */
  turnCostDollars?: number;
}

/** A sidebar entry — a chat-style session that can hold multiple appended
 *  search turns. Typing a new query while a session is active appends a new
 *  SearchRecord to it rather than starting a new session. */
export interface Session {
  id: string;
  recordIds: string[];
  createdAt: number;
  /** Bumped on every new turn — sidebar sorts by this, most recent first. */
  lastActiveAt: number;
}

// ---------- Build Brief (Agent API + Connect) ----------

// Exa's structured output doesn't tag which provider supplied each signal —
// the only real per-item evidence is `output.grounding[].citations[].url`.
// Attribution we can actually stand behind lives at the run level (below),
// derived from costDollars.dataSources — not fabricated per signal.
export interface WhyNowSignal {
  signal: string;
  source: string; // citation URL
  date: string;
}

export interface BriefOutput {
  email: string | null;
  whyNow: WhyNowSignal[];
}

/** Real /agent/runs costDollars shape: a flat object, not an array. */
export interface BriefCostBreakdown {
  total: number;
  agentCompute: number;
  search: number;
  /** Per-provider cost, e.g. { fiber_ai: 0.04 }. Only includes providers the
   *  router actually called — absent key means "not routed to". */
  dataSources: Record<string, number>;
}

export interface BriefRequestBody {
  query: string;
  dataSources: { provider: string }[];
  outputSchema: object;
}

export interface BriefRecord {
  personId: string;
  personName: string;
  request: BriefRequestBody;
  output: BriefOutput;
  /** Which attached sources the agent's router actually called — derived
   *  from costDollars.dataSources keys, not a separate API field. */
  routedTo: string[];
  cost: BriefCostBreakdown;
  durationMs: number;
  source: "fixture" | "live";
  /** The complete agent run object as returned by /agent/runs — includes
   *  output.text, output.grounding[] (per-field citations), usage, and the
   *  echoed request. Shown by the Raw toggle on the brief card. */
  raw?: unknown;
}

// ---------- Profile drawer (Exa /contents) ----------

/** POST /contents body — ids from /search work directly (for people results
 *  that's the library entity URL). */
export interface ContentsRequestBody {
  ids: string[];
  text: { maxCharacters: number };
  summary: { query: string };
}

export interface ContentsResult {
  id: string;
  url: string;
  title: string | null;
  author?: string | null;
  publishedDate?: string | null;
  image?: string | null;
  text?: string;
  summary?: string;
}

export interface ContentsResponse {
  requestId?: string;
  results: ContentsResult[];
  /** Per-document fetch status — `source` says cached vs live-crawled. */
  statuses?: { id: string; status: string; source?: string }[];
  costDollars?: { total: number };
}

/** Cached per person — a second click reopens without re-billing. */
export interface ContentsRecord {
  personId: string;
  personName: string;
  request: ContentsRequestBody;
  response: ContentsResponse;
  durationMs: number;
}

/** One entry in the session cost meter / call history. */
export interface CostEntry {
  id: string;
  type: "search" | "brief" | "verify" | "contents";
  /** Display text — the query for a search, the person's name for a brief. */
  label: string;
  amount: number;
  timestamp: number;
  breakdown?: { label: string; amount: number }[];
  /** Which SearchRecord to select when jumping to this call. */
  searchId: string;
  /** For brief entries, which person's brief to open within that search. */
  personId?: string;
}

// ---------- Re-run with Agent (verification pass over /search results) ----------

// /search can't express negation ("doesn't have X") — dense embeddings don't
// reliably encode "not," so a query like that surfaces the opposite of what
// it asks for. The fix isn't different phrasing, it's a different tool: the
// Agent actually researches each candidate and verifies the claim, the same
// "search, read, reason, write" pattern Exa's own docs use for boolean
// verification fields (company_verified_as_exa_ai, identity_verified, etc).
export interface VerifiedCandidate {
  personId: string;
  matches: boolean;
  reason: string;
}

export interface VerifyOutput {
  verified: VerifiedCandidate[];
}

export interface VerifyRequestBody {
  query: string;
  /** Documented Agent API pattern for handing records to a run: one output
   *  row per input row (see exa.ai/docs "Enrich input rows" example). */
  input: { data: { personId: string; name: string; title: string; company: string }[] };
  outputSchema: object;
}

export interface VerifyRecord {
  searchId: string;
  request: VerifyRequestBody;
  output: VerifyOutput;
  cost: BriefCostBreakdown;
  durationMs: number;
  /** The complete agent run object — same Raw affordance as briefs. */
  raw?: unknown;
}
