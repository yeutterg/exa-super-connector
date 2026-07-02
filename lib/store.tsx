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
  CostEntry,
  Person,
  SearchRecord,
  Session,
  RerunOptions,
  VerifyRecord,
} from "@/lib/types";
import {
  PROVIDER_LABELS,
  buildBriefBody,
  buildSearchBody,
  normalizePeople,
} from "@/lib/exa";
import { HERO_QUERIES, SEED_BRIEFS, fallbackFor, seedSearches } from "@/lib/fixtures";

const LS_RECORDS_KEY = "superconnector.liveSearches.v1";
const LS_SESSIONS_KEY = "superconnector.liveSessions.v1";
const LS_BRIEFS_KEY = "superconnector.liveBriefs.v1";
const LS_VERIFY_KEY = "superconnector.liveVerify.v1";
const LS_COST_KEY = "superconnector.liveCostEntries.v1";
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
  runBrief: (person: Person, searchId: string) => Promise<void>;
  closeBrief: () => void;
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
            request: buildBriefBody({
              name: b.personName,
              title: "",
              company: "",
            }),
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
    } catch {
      // quota exceeded — persistence is best-effort
    }
  }, [searches, sessions, briefs, verifyResults, costEntries]);

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
      if (activeTurns.length > 0 && !isHeroExact && !options) {
        try {
          const res = await fetch("/api/expand-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originalQuery: activeTurns[0].query,
              followUp: trimmed,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.expandedQuery && data.expandedQuery !== trimmed) {
              effectiveQuery = data.expandedQuery;
              rawInput = trimmed;
            }
          }
        } catch {
          // fall through with the raw follow-up text unchanged
        }
      }

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
            record = {
              id: `live-${Date.now()}-${idCounter.current++}`,
              query: effectiveQuery,
              rawInput,
              createdAt: Date.now(),
              source: "live",
              request: data.request,
              response: data.response,
              people: normalizePeople(data.response),
              durationMs: data.durationMs,
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
      // Step 1: GPT-5 nano rewrites the query into deep-search format —
      // comma-separated explicit constraints decompose better agentically.
      // Fails open to the original query.
      let rewritten = record.query;
      try {
        const res = await fetch("/api/rewrite-deep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: record.query }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.rewritten) rewritten = data.rewritten;
        }
      } catch {
        // fall through with the original query
      }
      setRerunningDeepId(null);
      // Step 2: run it deep on the people corpus + entity extraction — one
      // call returns BOTH people results (entities[] intact, so the familiar
      // people table renders) AND the synthesized findings (verified live).
      // The rewritten query is visible in the new turn's request code; the
      // original is kept as rawInput so the turn shows what it was rewritten
      // from.
      await runQuery(
        rewritten,
        {
          type: "deep",
          category: "people",
          numResults: record.request.numResults ?? 5,
          extractEntities: true,
        },
        rewritten !== record.query ? record.query : undefined,
      );
    },
    [searchLoading, rerunningDeepId, runQuery],
  );

  const runVerify = useCallback(
    async (record: SearchRecord) => {
      if (verifyLoadingId) return;
      setVerifyError(null);
      setVerifyLoadingId(record.id);
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
    [verifyLoadingId, addCost, bumpSessionActivity],
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
      setOpenBriefPersonId(entry.type === "brief" ? (entry.personId ?? null) : null);
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
    runBrief,
    closeBrief,
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
