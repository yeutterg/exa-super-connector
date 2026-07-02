"use client";

// Session state: sidebar sessions (each holding one or more appended search
// turns), briefs, verification, cost meter. Fixtures are seeded fresh on
// every load as their own single-turn sessions; live sessions persist to
// localStorage.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BriefRecord,
  ContentsRecord,
  CostEntry,
  Person,
  SearchRecord,
  Session,
  RerunOptions,
  VerifyRecord,
} from "@/lib/types";
import {
  LEADER_TITLE_RE,
  PROVIDER_LABELS,
  buildBriefBody,
  buildPeopleAtCompanyQuery,
  buildSearchBody,
  normalizePeople,
} from "@/lib/exa";
import {
  DEEP_PIPELINE_FALLBACK,
  HERO_QUERIES,
  SEED_BRIEFS,
  SEED_CONTENTS,
  SEED_VERIFY,
  fallbackFor,
  seedSearches,
} from "@/lib/fixtures";

const LS_RECORDS_KEY = "superconnector.liveSearches.v1";
const LS_SESSIONS_KEY = "superconnector.liveSessions.v1";
const LS_BRIEFS_KEY = "superconnector.liveBriefs.v1";
const LS_VERIFY_KEY = "superconnector.liveVerify.v1";
const LS_COST_KEY = "superconnector.liveCostEntries.v1";
const LS_CONTENTS_KEY = "superconnector.liveContents.v1";
// Simulated latency for cached-fixture replays — mimics real Exa response times.
const FIXTURE_REPLAY_MS = 1100;
const BRIEF_REPLAY_MS = 1800;

interface AppState {
  searches: SearchRecord[];
  sessions: Session[];
  activeSessionId: string | null;
  activeTurns: SearchRecord[];
  briefs: Record<string, BriefRecord>;
  openBriefPersonId: string | null;
  briefLoadingId: string | null;
  briefError: string | null;
  searchLoading: boolean;
  searchError: string | null;
  verifyResults: Record<string, VerifyRecord>;
  verifyLoadingId: string | null;
  verifyError: string | null;
  runVerify: (record: SearchRecord) => Promise<void>;
  costEntries: CostEntry[];
  costTotal: number;
  callCount: number;
  rawView: boolean;
  setRawView: (v: boolean) => void;
  callHistoryOpen: boolean;
  setCallHistoryOpen: (v: boolean) => void;
  goToCall: (entry: CostEntry) => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  resetToHome: () => void;
  runQuery: (
    query: string,
    options?: RerunOptions,
    rawInputOverride?: string,
  ) => Promise<void>;
  /** One-click debug path: GPT-5 nano rewrites the query into deep-search
   *  format (comma-separated constraints), then re-runs it as deep + web +
   *  entity extraction — the rewritten query is visible in the request code. */
  rerunAsDeep: (record: SearchRecord) => Promise<void>;
  rerunningDeepId: string | null;
  /** What the deep pipeline is doing right now — narrated under the loading
   *  skeleton so the 10s deep call isn't a silent gap on stage. */
  pipelineStage: string | null;
  runBrief: (person: Person, searchId: string) => Promise<void>;
  closeBrief: () => void;
  /** Profile drawer (Exa /contents): cached per person — the call bills once
   *  and lands in the call history; re-clicks reopen from cache. */
  contentsRecords: Record<string, ContentsRecord>;
  openContentsPersonId: string | null;
  contentsLoadingId: string | null;
  contentsError: string | null;
  runContents: (person: Person, searchId: string) => Promise<void>;
  closeContents: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<Record<string, BriefRecord>>({});
  const [openBriefPersonId, setOpenBriefPersonId] = useState<string | null>(null);
  const [briefLoadingId, setBriefLoadingId] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [rerunningDeepId, setRerunningDeepId] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [contentsRecords, setContentsRecords] = useState<Record<string, ContentsRecord>>({});
  const [openContentsPersonId, setOpenContentsPersonId] = useState<string | null>(null);
  const [contentsLoadingId, setContentsLoadingId] = useState<string | null>(null);
  const [contentsError, setContentsError] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyRecord>>({});
  const [verifyLoadingId, setVerifyLoadingId] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [rawView, setRawView] = useState(false);
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);
  const idCounter = useRef(0);
  const nextId = () => `cost-${Date.now()}-${idCounter.current++}`;

  // Shallow URL sync: each session gets /s/<id>, home is /. History entries
  // are pushed so browser back/forward walks between chats; popstate below
  // maps URL changes back into state.
  const syncUrl = useCallback((sessionId: string | null) => {
    if (typeof window === "undefined") return;
    const path = sessionId ? `/s/${encodeURIComponent(sessionId)}` : "/";
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  }, []);

  const sessionIdFromPath = () => {
    const m = window.location.pathname.match(/^\/s\/([^/]+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  // Seed fixtures + restore persisted live sessions once, on mount.
  // localStorage is unavailable during SSR, so this must live in an effect;
  // the one-time sync setState here is the standard hydration-boundary load.
  useEffect(() => {
    const seeded = seedSearches();
    let restoredRecords: SearchRecord[] = [];
    let restoredSessions: Session[] = [];
    let restoredBriefs: Record<string, BriefRecord> = {};
    let restoredVerify: Record<string, VerifyRecord> = {};
    let restoredCost: CostEntry[] = [];
    let restoredContents: Record<string, ContentsRecord> = {};
    try {
      const rawRecords = localStorage.getItem(LS_RECORDS_KEY);
      if (rawRecords) restoredRecords = JSON.parse(rawRecords) as SearchRecord[];
      const rawSessions = localStorage.getItem(LS_SESSIONS_KEY);
      if (rawSessions) restoredSessions = JSON.parse(rawSessions) as Session[];
      const rawBriefs = localStorage.getItem(LS_BRIEFS_KEY);
      if (rawBriefs) restoredBriefs = JSON.parse(rawBriefs) as Record<string, BriefRecord>;
      const rawVerify = localStorage.getItem(LS_VERIFY_KEY);
      if (rawVerify) restoredVerify = JSON.parse(rawVerify) as Record<string, VerifyRecord>;
      const rawCost = localStorage.getItem(LS_COST_KEY);
      if (rawCost) restoredCost = JSON.parse(rawCost) as CostEntry[];
      const rawContents = localStorage.getItem(LS_CONTENTS_KEY);
      if (rawContents)
        restoredContents = JSON.parse(rawContents) as Record<string, ContentsRecord>;
    } catch {
      // corrupt persisted state — start clean
    }
    const seededSessions: Session[] = seeded.map((s) => ({
      id: `fixture-session-${s.id}`,
      recordIds: [s.id],
      createdAt: s.createdAt,
      lastActiveAt: s.createdAt,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearches([...restoredRecords, ...seeded]);
    setSessions([...restoredSessions, ...seededSessions]);
    setVerifyResults(restoredVerify);
    // Pre-warmed profile extraction (guardrail: the person the demo clicks
    // opens instantly, even offline). Restored live records win on key clash.
    setContentsRecords({ ...SEED_CONTENTS, ...restoredContents });
    // The example searches already "cost" something — count them in the
    // session meter from the start, not just live/wildcard queries. Restored
    // (real, previously billed) entries are layered on top so a reload never
    // loses track of money already spent.
    setCostEntries([
      ...seeded.map((s, i) => ({
        id: `cost-seed-${i}`,
        type: "search" as const,
        label: s.query,
        amount: s.response.costDollars?.total ?? 0,
        timestamp: s.createdAt,
        searchId: s.id,
      })),
      ...restoredCost,
    ]);
    setBriefs({
      ...Object.fromEntries(
        Object.entries(SEED_BRIEFS).map(([personId, b]) => [
          personId,
          {
            ...b,
            // Prefer the request captured with the fixture (real echo from
            // the run) — synthesize one only for older fixtures without it.
            request:
              (b as BriefRecord).request ??
              buildBriefBody({ name: b.personName, title: "", company: "" }),
          } as BriefRecord,
        ]),
      ),
      ...restoredBriefs,
    });
    // Deep link: /s/<id> activates that session if it exists on this browser;
    // unknown ids fall back to home without leaving a broken URL behind.
    const linked = sessionIdFromPath();
    if (linked) {
      const all = [...restoredSessions, ...seededSessions];
      if (all.some((s) => s.id === linked)) {
        setActiveSessionId(linked);
      } else {
        window.history.replaceState(null, "", "/");
      }
    }
  }, []);

  // Browser back/forward walks between chats.
  useEffect(() => {
    const onPop = () => {
      setActiveSessionId(sessionIdFromPath());
      setOpenBriefPersonId(null);
      setBriefError(null);
      setRawView(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Persist everything real — non-seed records/sessions, live briefs, verify
  // results, and non-seed cost entries — so a reload never re-triggers a
  // paid Exa call for something already fetched, and never loses spend
  // already counted in the cost meter.
  useEffect(() => {
    const liveRecords = searches.filter((s) => !s.id.startsWith("fixture-"));
    const liveSessions = sessions.filter((s) => !s.id.startsWith("fixture-session-"));
    const liveBriefs = Object.fromEntries(
      Object.entries(briefs).filter(([, b]) => b.source === "live"),
    );
    const liveCost = costEntries.filter((e) => !e.id.startsWith("cost-seed-"));
    try {
      localStorage.setItem(LS_RECORDS_KEY, JSON.stringify(liveRecords));
      localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(liveSessions));
      localStorage.setItem(LS_BRIEFS_KEY, JSON.stringify(liveBriefs));
      localStorage.setItem(LS_VERIFY_KEY, JSON.stringify(verifyResults));
      localStorage.setItem(LS_COST_KEY, JSON.stringify(liveCost));
      localStorage.setItem(LS_CONTENTS_KEY, JSON.stringify(contentsRecords));
    } catch {
      // quota exceeded — persistence is best-effort
    }
  }, [searches, sessions, briefs, verifyResults, costEntries, contentsRecords]);

  const activeTurns = useMemo(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session) return [];
    return session.recordIds
      .map((id) => searches.find((s) => s.id === id))
      .filter((r): r is SearchRecord => Boolean(r));
  }, [sessions, activeSessionId, searches]);

  const addCost = useCallback((entry: CostEntry) => {
    setCostEntries((prev) => [...prev, entry]);
  }, []);

  // Build Brief / Verify also count as "activity" for sidebar ordering.
  const bumpSessionActivity = useCallback((searchId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.recordIds.includes(searchId) ? { ...s, lastActiveAt: Date.now() } : s,
      ),
    );
  }, []);

  const selectSession = useCallback(
    (id: string) => {
      // History navigation: instant, no network, no cost tick.
      setActiveSessionId(id);
      setOpenBriefPersonId(null);
      setBriefError(null);
      setRawView(false);
      syncUrl(id);
    },
    [syncUrl],
  );

  const resetToHome = useCallback(() => {
    // "New chat"-style reset: back to the empty state, ready to start a new
    // session on the next query. History is untouched.
    setActiveSessionId(null);
    setOpenBriefPersonId(null);
    setBriefError(null);
    setRawView(false);
    syncUrl(null);
  }, [syncUrl]);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setOpenBriefPersonId(null);
        setBriefError(null);
        setRawView(false);
        syncUrl(null);
      }
    },
    [activeSessionId, syncUrl],
  );

  const runQuery = useCallback(
    async (query: string, options?: RerunOptions, rawInputOverride?: string) => {
      const trimmed = query.trim();
      if (!trimmed || searchLoading) return;
      setSearchLoading(true);
      setSearchError(null);
      setOpenBriefPersonId(null);
      setBriefError(null);
      setRawView(false);

      const isHeroExact = HERO_QUERIES.some(
        (q) => q.toLowerCase() === trimmed.toLowerCase(),
      );

      // Follow-up inside an already-open session ("3 more people") gets
      // expanded via GPT-5 nano into a standalone query before it hits Exa —
      // skipped for exact hero-query matches (deterministic replay), for the
      // first query of a fresh session (nothing to expand against yet), and
      // for parameterized re-runs (same query on purpose, different knobs).
      let effectiveQuery = trimmed;
      let rawInput: string | undefined = rawInputOverride;
      // Everyone already shown in this session — "10 more profiles" must not
      // re-serve them. Exclusion happens HERE, deterministically: /search has
      // no exclusion parameter, and embeddings can't reliably encode "not
      // these people" (the negation weakness this app demonstrates) — so we
      // over-fetch and filter by result id instead of asking the query to
      // exclude names. The list is kept on the record so the UI can show it
      // next to the request code.
      const seenPeople = activeTurns.flatMap((t) =>
        t.people.map((p) => ({ id: p.id, name: p.name, company: p.company })),
      );
      const seenIds = new Set(seenPeople.map((p) => p.id));
      let requestedCount: number | null = null;
      let exclusionApplied = false;
      if (activeTurns.length > 0 && !isHeroExact && !options) {
        try {
          const res = await fetch("/api/expand-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originalQuery: activeTurns[0].query,
              followUp: trimmed,
              shownPeople: seenPeople.map((p) => `${p.name} (${p.company})`),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.expandedQuery && data.expandedQuery !== trimmed) {
              effectiveQuery = data.expandedQuery;
              rawInput = trimmed;
            }
            if (typeof data.numResults === "number") {
              requestedCount = data.numResults;
            }
          }
        } catch {
          // fall through with the raw follow-up text unchanged
        }
        // Nano edited numResults, or there are prior people to avoid
        // re-serving: build explicit options with headroom for the dedup.
        if (requestedCount !== null || seenIds.size > 0) {
          const want = requestedCount ?? 5;
          exclusionApplied = seenIds.size > 0;
          options = {
            type: "auto",
            category: "people",
            numResults: Math.min(want + seenIds.size, 100),
            extractEntities: false,
          };
        }
      }
      // How many rows the turn should end up with after dedup.
      const targetCount = requestedCount ?? undefined;

      // Hero queries replay their fixture with full theater — recorded latency
      // and recorded cost — so the scripted beats are deterministic on stage.
      // Parameterized re-runs always go live: the whole point is watching the
      // same query behave differently under different retrieval settings.
      let record: SearchRecord | undefined;
      let isNewRecord = false;

      if (!options) {
        const heroIndex = HERO_QUERIES.findIndex(
          (q) => q.toLowerCase() === effectiveQuery.toLowerCase(),
        );
        if (heroIndex >= 0) {
          const found = searches.find((s) => s.id === `fixture-${heroIndex + 1}`);
          if (found) {
            await sleep(FIXTURE_REPLAY_MS);
            record = found;
          }
        }
      }

      // Live call. Default searches fall back to fixtures silently (scope
      // guardrail #5); re-runs surface the error instead — swapping in people
      // fixtures under a deep/web re-run would falsify the comparison.
      if (!record) {
        try {
          const res = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: effectiveQuery, options }),
          });
          if (res.ok) {
            const data = await res.json();
            // Drop anyone already shown earlier in the session, then trim to
            // the count the user asked for (we over-fetched to compensate).
            const normalized = normalizePeople(data.response);
            const fresh = normalized.filter((p) => !seenIds.has(p.id));
            record = {
              id: `live-${Date.now()}-${idCounter.current++}`,
              query: effectiveQuery,
              rawInput,
              createdAt: Date.now(),
              source: "live",
              request: data.request,
              response: data.response,
              people: targetCount ? fresh.slice(0, targetCount) : fresh,
              durationMs: data.durationMs,
              exclusion: exclusionApplied ? seenPeople : undefined,
              excludedHits: exclusionApplied
                ? normalized.length - fresh.length
                : undefined,
            };
            isNewRecord = true;
          } else if (options) {
            const err = await res.json().catch(() => ({}));
            setSearchError(err.error ?? `search failed (${res.status})`);
            setSearchLoading(false);
            return;
          }
        } catch (err) {
          if (options) {
            setSearchError(err instanceof Error ? err.message : "search failed");
            setSearchLoading(false);
            return;
          }
          // fall through to fixture fallback
        }
        if (!record) {
          const fb = fallbackFor(effectiveQuery);
          await sleep(FIXTURE_REPLAY_MS);
          record = {
            id: `fb-${Date.now()}-${idCounter.current++}`,
            query: effectiveQuery,
            rawInput,
            createdAt: Date.now(),
            source: "fixture",
            request: buildSearchBody(effectiveQuery),
            response: fb.response,
            people: normalizePeople(fb.response),
            durationMs: fb.durationMs,
          };
          isNewRecord = true;
        }
      }

      const finalRecord = record;
      if (isNewRecord) {
        setSearches((prev) => [finalRecord, ...prev]);
      }

      // Typing while a session is open appends a new turn to it; otherwise
      // this query starts a brand new session. Either way, this session
      // becomes the most recently active — sidebar sorts on that. Replaying
      // a hero fixture already present in the session must NOT append its
      // record id again — recordIds are React keys, duplicates would collide.
      const newSessionId = `session-${Date.now()}-${idCounter.current++}`;
      const now = Date.now();
      setSessions((prev) => {
        if (activeSessionId && prev.some((s) => s.id === activeSessionId)) {
          return prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  recordIds: s.recordIds.includes(finalRecord.id)
                    ? s.recordIds
                    : [...s.recordIds, finalRecord.id],
                  lastActiveAt: now,
                }
              : s,
          );
        }
        return [
          { id: newSessionId, recordIds: [finalRecord.id], createdAt: now, lastActiveAt: now },
          ...prev,
        ];
      });
      if (!activeSessionId) {
        setActiveSessionId(newSessionId);
        syncUrl(newSessionId);
      }

      addCost({
        id: nextId(),
        type: "search",
        label: effectiveQuery,
        amount: finalRecord.response.costDollars?.total ?? 0,
        timestamp: Date.now(),
        searchId: finalRecord.id,
      });
      setSearchLoading(false);
    },
    [searches, searchLoading, activeSessionId, activeTurns, addCost, syncUrl],
  );

  const rerunAsDeep = useCallback(
    async (record: SearchRecord) => {
      if (searchLoading || rerunningDeepId) return;
      setRerunningDeepId(record.id);
      setSearchError(null);
      setSearchLoading(true);
      setPipelineStage("1/3 · gpt-5-nano is rewriting the query into deep-search format…");

      // Step 1: GPT-5 nano rewrites the query into deep-search format —
      // comma-separated explicit constraints decompose better agentically.
      // Fails open to the original query.
      let rewritten = record.query;
      let rewriteRequest: object | undefined;
      try {
        const res = await fetch("/api/rewrite-deep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: record.query }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.rewritten) rewritten = data.rewritten;
          if (data.request) rewriteRequest = data.request;
        }
      } catch {
        // fall through with the original query
      }
      setRerunningDeepId(null);
      setPipelineStage(
        "2/3 · deep search is decomposing the query across the web (with outputSchema extraction)…",
      );

      try {
        // Step 2: deep search WEB-WIDE with entity extraction. Deliberately
        // not category-scoped: the discriminating constraint (a job posting,
        // funding news) lives outside profiles — deep + category:people just
        // returns semantically-nearby RevOps titleholders again (verified
        // live, twice). The web-wide run finds the right companies with
        // citations.
        const deepRes = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: rewritten,
            options: {
              type: "deep",
              category: null,
              numResults: record.request.numResults ?? 5,
              extractEntities: true,
            },
          }),
        });
        if (!deepRes.ok) {
          const err = await deepRes.json().catch(() => ({}));
          throw new Error(err.error ?? `deep search failed (${deepRes.status})`);
        }
        const deepData = await deepRes.json();
        const findings: { entity: string }[] =
          deepData.response?.output?.content?.findings ?? [];

        // Step 3: the join — a FAN-OUT, one focused people search per
        // extracted company, in parallel. A single blended query ("leader at
        // A, B, C, D") embeds as an average and retrieval drifts: multiple
        // people from one company, none from another, AEs outranking actual
        // leaders. One query per company makes coverage structural; a title
        // check picks the leader among each company's candidates.
        const people: Person[] = [];
        const joinRequests: SearchRecord["joinRequests"] = [];
        const joinCosts: { company: string; amount: number }[] = [];
        let joinMs = 0;
        if (findings.length > 0) {
          const companies = [
            ...new Set(findings.slice(0, 5).map((f) => f.entity)),
          ];
          setPipelineStage(
            `3/3 · join: ${companies.length} parallel people searches, one leader per company…`,
          );
          const joinStarted = Date.now();
          const joins = await Promise.all(
            companies.map(async (company) => {
              try {
                const joinRes = await fetch("/api/search", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    query: buildPeopleAtCompanyQuery(company),
                    options: {
                      type: "auto",
                      category: "people",
                      numResults: 3, // headroom for the leader-title pick
                      extractEntities: false,
                    },
                  }),
                });
                if (!joinRes.ok) return null;
                return { company, data: await joinRes.json() };
              } catch {
                return null; // join is best-effort — findings still render
              }
            }),
          );
          joinMs = Date.now() - joinStarted;
          for (const j of joins) {
            if (!j) continue;
            const candidates = normalizePeople(j.data.response);
            // First leader-titled candidate wins; fall back to the top match
            // so a company without a titled leader still contributes someone.
            const leader =
              candidates.find((p) => LEADER_TITLE_RE.test(p.title)) ??
              candidates[0];
            if (leader && !people.some((p) => p.id === leader.id)) {
              people.push(leader);
            }
            joinRequests.push(j.data.request);
            joinCosts.push({
              company: j.company,
              amount: j.data.response?.costDollars?.total ?? 0,
            });
          }
        }

        commitDeepTurn({
          query: rewritten,
          rawInput: rewritten !== record.query ? record.query : undefined,
          request: deepData.request,
          response: deepData.response,
          people,
          durationMs: (deepData.durationMs ?? 0) + joinMs,
          joinRequests,
          rewriteRequest,
          deepCost: deepData.response?.costDollars?.total ?? 0,
          joinCosts,
          source: "live",
        });
      } catch (err) {
        // Stage guardrail: if the live pipeline dies AND this is the hero
        // query, silently replay the recorded pipeline (real captured Exa
        // data) instead of showing an error — the light always lights up.
        const fb = DEEP_PIPELINE_FALLBACK;
        if (record.query === fb.query) {
          await sleep(2500);
          const people: Person[] = [];
          const joinCosts: { company: string; amount: number }[] = [];
          for (const j of fb.joins) {
            const candidates = normalizePeople(j.response);
            const leader =
              candidates.find((p) => LEADER_TITLE_RE.test(p.title)) ??
              candidates[0];
            if (leader && !people.some((p) => p.id === leader.id)) {
              people.push(leader);
            }
            joinCosts.push({
              company: j.company,
              amount: j.response.costDollars?.total ?? 0,
            });
          }
          commitDeepTurn({
            query: fb.rewritten,
            rawInput: fb.rewritten !== fb.query ? fb.query : undefined,
            request: fb.deep.request,
            response: fb.deep.response,
            people,
            durationMs:
              fb.deep.durationMs +
              Math.max(...fb.joins.map((j) => j.durationMs), 0),
            joinRequests: fb.joins.map((j) => j.request),
            rewriteRequest: fb.rewriteRequest,
            deepCost: fb.deep.response.costDollars?.total ?? 0,
            joinCosts,
            source: "fixture",
          });
        } else {
          setSearchError(err instanceof Error ? err.message : "deep re-run failed");
        }
      } finally {
        setSearchLoading(false);
        setPipelineStage(null);
      }

      // Shared commit for live and fixture-replay pipelines: one record, one
      // session append, honest cost entries.
      function commitDeepTurn(turn: {
        query: string;
        rawInput?: string;
        request: SearchRecord["request"];
        response: SearchRecord["response"];
        people: Person[];
        durationMs: number;
        joinRequests: NonNullable<SearchRecord["joinRequests"]>;
        rewriteRequest?: object;
        deepCost: number;
        joinCosts: { company: string; amount: number }[];
        source: "live" | "fixture";
      }) {
        const newRecord: SearchRecord = {
          id: `live-${Date.now()}-${idCounter.current++}`,
          query: turn.query,
          rawInput: turn.rawInput,
          createdAt: Date.now(),
          source: turn.source,
          request: turn.request,
          response: turn.response,
          people: turn.people,
          durationMs: turn.durationMs,
          joinRequests: turn.joinRequests.length ? turn.joinRequests : undefined,
          rewriteRequest: turn.rewriteRequest,
          // Whole-turn cost: the deep call plus every join call — the pill
          // shouldn't under-report a multi-call turn.
          turnCostDollars:
            turn.deepCost +
            turn.joinCosts.reduce((acc, jc) => acc + jc.amount, 0),
        };
        setSearches((prev) => [newRecord, ...prev]);
        const now = Date.now();
        const newSessionId = `session-${now}-${idCounter.current++}`;
        setSessions((prev) => {
          if (activeSessionId && prev.some((s) => s.id === activeSessionId)) {
            return prev.map((s) =>
              s.id === activeSessionId
                ? { ...s, recordIds: [...s.recordIds, newRecord.id], lastActiveAt: now }
                : s,
            );
          }
          return [
            { id: newSessionId, recordIds: [newRecord.id], createdAt: now, lastActiveAt: now },
            ...prev,
          ];
        });
        if (!activeSessionId) {
          setActiveSessionId(newSessionId);
          syncUrl(newSessionId);
        }
        addCost({
          id: nextId(),
          type: "search",
          label: `deep · ${turn.query}`,
          amount: turn.deepCost,
          timestamp: Date.now(),
          searchId: newRecord.id,
        });
        for (const jc of turn.joinCosts) {
          addCost({
            id: nextId(),
            type: "search",
            label: `join · leader at ${jc.company}`,
            amount: jc.amount,
            timestamp: Date.now(),
            searchId: newRecord.id,
          });
        }
      }
    },
    [searchLoading, rerunningDeepId, activeSessionId, addCost, syncUrl],
  );

  const runContents = useCallback(
    async (person: Person, searchId: string) => {
      setContentsError(null);
      setOpenContentsPersonId(person.id);
      // Cached — reopen instantly, no re-bill.
      if (contentsRecords[person.id] || contentsLoadingId) return;
      setContentsLoadingId(person.id);
      try {
        const res = await fetch("/api/contents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: person.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const rec: ContentsRecord = {
          personId: person.id,
          personName: person.name,
          request: data.request,
          response: data.response,
          durationMs: data.durationMs,
        };
        setContentsRecords((prev) => ({ ...prev, [person.id]: rec }));
        addCost({
          id: nextId(),
          type: "contents",
          label: `contents · ${person.name}`,
          amount: data.response?.costDollars?.total ?? 0,
          timestamp: Date.now(),
          searchId,
          personId: person.id,
        });
        bumpSessionActivity(searchId);
      } catch (err) {
        setContentsError(err instanceof Error ? err.message : "contents fetch failed");
      } finally {
        setContentsLoadingId(null);
      }
    },
    [contentsRecords, contentsLoadingId, addCost, bumpSessionActivity],
  );

  const closeContents = useCallback(() => {
    setOpenContentsPersonId(null);
    setContentsError(null);
  }, []);

  // Track whether a seeded verify replay already ticked the meter.
  const verifyTicked = useRef(new Set<string>());

  const runVerify = useCallback(
    async (record: SearchRecord) => {
      if (verifyLoadingId) return;
      setVerifyError(null);
      setVerifyLoadingId(record.id);
      // Recorded replay for the fixture turn — deterministic on stage and
      // works offline; live turns (e.g. the deep join people) still go live.
      const seed = SEED_VERIFY[record.id];
      if (seed && !verifyResults[record.id]) {
        await sleep(2200);
        const seeded: VerifyRecord = { ...seed, searchId: record.id };
        setVerifyResults((prev) => ({ ...prev, [record.id]: seeded }));
        if (!verifyTicked.current.has(record.id)) {
          verifyTicked.current.add(record.id);
          addCost(verifyCostEntry(nextId(), record, seeded));
        }
        bumpSessionActivity(record.id);
        setVerifyLoadingId(null);
        return;
      }
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: record.query, people: record.people }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const verifyRecord: VerifyRecord = {
          searchId: record.id,
          request: data.request,
          output: data.output,
          cost: data.cost,
          durationMs: data.durationMs,
          raw: data.raw,
        };
        setVerifyResults((prev) => ({ ...prev, [record.id]: verifyRecord }));
        addCost(verifyCostEntry(nextId(), record, verifyRecord));
        bumpSessionActivity(record.id);
      } catch (err) {
        setVerifyError(err instanceof Error ? err.message : "verification failed");
      } finally {
        setVerifyLoadingId(null);
      }
    },
    [verifyLoadingId, verifyResults, addCost, bumpSessionActivity],
  );

  // Track whether the pre-warmed brief already ticked the meter this session.
  const briefTicked = useRef(new Set<string>());
  const costEntriesHasBrief = useCallback((personId: string) => {
    if (briefTicked.current.has(personId)) return true;
    briefTicked.current.add(personId);
    return false;
  }, []);

  const runBrief = useCallback(
    async (person: Person, searchId: string) => {
      if (briefLoadingId) return;
      setBriefError(null);
      setOpenBriefPersonId(person.id);

      // Already built this session — reopen without re-billing.
      const existing = briefs[person.id];
      if (existing && existing.source !== "fixture") return;

      // Pre-warmed person (guardrail #2): replay the cached agent run.
      const seed = SEED_BRIEFS[person.id];
      if (seed) {
        if (existing && costEntriesHasBrief(person.id)) return; // already replayed
        setBriefLoadingId(person.id);
        await sleep(BRIEF_REPLAY_MS);
        const record: BriefRecord = {
          ...seed,
          request: buildBriefBody(person),
        } as BriefRecord;
        setBriefs((prev) => ({ ...prev, [person.id]: record }));
        addCost(briefCostEntry(nextId(), person, record, searchId));
        bumpSessionActivity(searchId);
        setBriefLoadingId(null);
        return;
      }

      // Live agent run for everyone else.
      setBriefLoadingId(person.id);
      try {
        const res = await fetch("/api/brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person: { name: person.name, title: person.title, company: person.company },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const record: BriefRecord = {
          personId: person.id,
          personName: person.name,
          request: data.request,
          output: data.output,
          routedTo: data.routedTo ?? [],
          cost: data.cost,
          durationMs: data.durationMs,
          source: "live",
          raw: data.raw,
        };
        setBriefs((prev) => ({ ...prev, [person.id]: record }));
        addCost(briefCostEntry(nextId(), person, record, searchId));
        bumpSessionActivity(searchId);
      } catch (err) {
        setBriefError(err instanceof Error ? err.message : "brief failed");
      } finally {
        setBriefLoadingId(null);
      }
    },
    [briefs, briefLoadingId, addCost, costEntriesHasBrief, bumpSessionActivity],
  );

  const closeBrief = useCallback(() => {
    setOpenBriefPersonId(null);
    setBriefError(null);
  }, []);

  const goToCall = useCallback(
    (entry: CostEntry) => {
      // Historical calls are always already-completed — jump straight to the
      // cached data, no re-fetch, no loading state.
      const session = sessions.find((s) => s.recordIds.includes(entry.searchId));
      if (session) {
        setActiveSessionId(session.id);
        syncUrl(session.id);
      }
      // Brief AND contents entries both live in the person drawer now.
      setOpenContentsPersonId(
        entry.type === "brief" || entry.type === "contents"
          ? (entry.personId ?? null)
          : null,
      );
      setBriefError(null);
      setRawView(false);
      setCallHistoryOpen(false);
    },
    [sessions, syncUrl],
  );

  const costTotal = useMemo(
    () => costEntries.reduce((acc, e) => acc + e.amount, 0),
    [costEntries],
  );

  const value: AppState = {
    searches,
    sessions,
    activeSessionId,
    activeTurns,
    briefs,
    openBriefPersonId,
    briefLoadingId,
    briefError,
    searchLoading,
    searchError,
    verifyResults,
    verifyLoadingId,
    verifyError,
    runVerify,
    costEntries,
    costTotal,
    callCount: costEntries.length,
    rawView,
    setRawView,
    callHistoryOpen,
    setCallHistoryOpen,
    goToCall,
    selectSession,
    deleteSession,
    resetToHome,
    runQuery,
    rerunAsDeep,
    rerunningDeepId,
    pipelineStage,
    runBrief,
    closeBrief,
    contentsRecords,
    openContentsPersonId,
    contentsLoadingId,
    contentsError,
    runContents,
    closeContents,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function briefCostEntry(
  id: string,
  person: Person,
  record: BriefRecord,
  searchId: string,
): CostEntry {
  const c = record.cost;
  const breakdown = [
    { label: "agent", amount: c.agentCompute },
    { label: "web search", amount: c.search },
    ...Object.entries(c.dataSources).map(([provider, amount]) => ({
      label: PROVIDER_LABELS[provider] ?? provider,
      amount,
    })),
  ].filter((b) => b.amount > 0);
  return {
    id,
    type: "brief",
    label: person.name,
    amount: c.total,
    timestamp: Date.now(),
    breakdown,
    searchId,
    personId: person.id,
  };
}

function verifyCostEntry(
  id: string,
  record: SearchRecord,
  verify: VerifyRecord,
): CostEntry {
  const c = verify.cost;
  const breakdown = [
    { label: "agent", amount: c.agentCompute },
    { label: "web search", amount: c.search },
  ].filter((b) => b.amount > 0);
  return {
    id,
    type: "verify",
    label: record.query,
    amount: c.total,
    timestamp: Date.now(),
    breakdown,
    searchId: record.id,
  };
}
