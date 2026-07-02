import { NextRequest, NextResponse } from "next/server";
import { EXA_BASE, buildSearchBody } from "@/lib/exa";
import type { RerunOptions } from "@/lib/types";

// POST /api/search { query, options? } → { request, response, durationMs } | { error }
// Calls Exa /search directly; the client owns fixture fallback so failures
// stay silent on stage (scope guardrail #5). `options` carries the Re-run
// debugging knobs (search type / corpus / freshness / extraction) — each a
// documented /search parameter, validated here against a whitelist.

const VALID_TYPES = new Set(["fast", "auto", "deep-lite", "deep"]);
const VALID_CATEGORIES = new Set(["people", "company", "news"]);

function sanitizeOptions(raw: unknown): RerunOptions | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const type = VALID_TYPES.has(String(o.type)) ? (String(o.type) as RerunOptions["type"]) : "auto";
  const category = VALID_CATEGORIES.has(String(o.category))
    ? (String(o.category) as RerunOptions["category"])
    : null;
  const numResults = Math.min(Math.max(Number(o.numResults) || 5, 1), 25);
  const startPublishedDate =
    typeof o.startPublishedDate === "string" &&
    /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(o.startPublishedDate)
      ? o.startPublishedDate
      : undefined;
  return {
    type,
    category,
    numResults,
    startPublishedDate,
    extractEntities: Boolean(o.extractEntities),
  };
}

export async function POST(req: NextRequest) {
  const { query, options } = await req.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "EXA_API_KEY not configured" },
      { status: 503 },
    );
  }

  const body = buildSearchBody(query, sanitizeOptions(options));
  const started = Date.now();
  try {
    const res = await fetch(`${EXA_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
      // Deep modes decompose + reason — give them room to run.
      signal: AbortSignal.timeout(body.type.startsWith("deep") ? 120_000 : 15_000),
    });
    const durationMs = Date.now() - started;
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `exa ${res.status}: ${text.slice(0, 300)}` },
        { status: 502 },
      );
    }
    const response = await res.json();
    return NextResponse.json({ request: body, response, durationMs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "request failed" },
      { status: 502 },
    );
  }
}
