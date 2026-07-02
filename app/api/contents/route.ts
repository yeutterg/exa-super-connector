import { NextRequest, NextResponse } from "next/server";
import { EXA_BASE, buildContentsBody } from "@/lib/exa";

// POST /api/contents { id } → { request, response, durationMs } | { error }
// Exa /contents accepts the ids returned by /search directly — for people
// results that's the library entity URL. Returns extracted page text plus a
// steered summary; the client caches per person so a second click never
// re-bills.

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id || typeof id !== "string" || id.length > 2048) {
    return NextResponse.json({ error: "missing or invalid id" }, { status: 400 });
  }

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "EXA_API_KEY not configured" }, { status: 503 });
  }

  const body = buildContentsBody(id);
  const started = Date.now();
  try {
    const res = await fetch(`${EXA_BASE}/contents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
      // Summary generation + possible livecrawl — allow more than plain search.
      signal: AbortSignal.timeout(30_000),
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
