// Shared helpers for calling Exa's Agent API from a route handler: create,
// poll to completion, and extract the real cost/routing shape. Used by both
// /api/brief (Connect-attached contact + why-now research) and /api/verify
// (pure web-research verification of a search result against its own query).

import { EXA_BASE } from "@/lib/exa";
import type { BriefCostBreakdown } from "@/lib/types";

const POLL_INTERVAL_MS = 1500;
// Runs that chase a provider AND fall back to web inference regularly take
// 60-90s (observed live) — 45s was cutting them off mid-run.
const POLL_TIMEOUT_MS = 110_000;

export type Json = Record<string, unknown>;

function headers(apiKey: string) {
  return { "Content-Type": "application/json", "x-api-key": apiKey };
}

// Documented run lifecycle: queued → running → completed | failed | cancelled.
// (Docs also offer SSE via `Accept: text/event-stream`; polling is fine for
// route handlers that hold the request open anyway.)
const TERMINAL_STATUSES = ["completed", "failed", "cancelled"];

/** Creates an agent run and polls until it reaches a terminal status. */
export async function createAndPollAgentRun(
  apiKey: string,
  body: object,
): Promise<{ run: Json; error?: string; status?: number }> {
  const started = Date.now();
  const createRes = await fetch(`${EXA_BASE}/agent/runs`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    return { run: {}, error: `exa ${createRes.status}: ${text.slice(0, 300)}`, status: 502 };
  }
  let run = (await createRes.json()) as Json;

  const runId = (run.id ?? run.runId) as string | undefined;
  const terminal = (r: Json) =>
    !r.status || TERMINAL_STATUSES.includes(String(r.status));
  while (runId && !terminal(run) && Date.now() - started < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const pollRes = await fetch(`${EXA_BASE}/agent/runs/${runId}`, {
      headers: headers(apiKey),
      signal: AbortSignal.timeout(15_000),
    });
    if (!pollRes.ok) break;
    run = (await pollRes.json()) as Json;
  }

  // Don't hand a dead run to callers as if it succeeded — they'd fail output
  // extraction and report a misleading "no structured output" error.
  const status = String(run.status ?? "");
  if (status === "failed" || status === "cancelled") {
    return { run, error: `agent run ${status}`, status: 502 };
  }
  if (status === "queued" || status === "running") {
    return { run, error: "agent run timed out before completing", status: 504 };
  }
  return { run };
}

/** Real /agent/runs costDollars shape is flat: { total, agentCompute, search,
 *  dataSources: { <provider>: $ } } — a data source only appears if the
 *  router actually called it this run. */
export function extractRunCost(run: Json): BriefCostBreakdown {
  const cd = (run.costDollars ?? {}) as Json;
  const rawSources = (cd.dataSources ?? {}) as Json;
  const dataSources = Object.fromEntries(
    Object.entries(rawSources).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
  return {
    total: typeof cd.total === "number" ? cd.total : 0,
    agentCompute: typeof cd.agentCompute === "number" ? cd.agentCompute : 0,
    search: typeof cd.search === "number" ? cd.search : 0,
    dataSources,
  };
}

export function extractRoutedTo(run: Json): string[] {
  const cd = (run.costDollars ?? {}) as Json;
  const dataSources = (cd.dataSources ?? {}) as Json;
  return Object.keys(dataSources);
}

/** The outputSchema-conforming object lives at output.structured on a
 *  completed run — but fall back to a few other likely locations defensively. */
export function extractStructuredOutput(run: Json): Json | null {
  const candidates = [
    (run.output as Json | undefined)?.structured,
    run.output,
    run.structuredOutput,
    run.result,
    (run.data as Json | undefined)?.output,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && Object.keys(c).length > 0) return c as Json;
  }
  return null;
}
