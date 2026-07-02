import { NextRequest, NextResponse } from "next/server";

// POST /api/expand-query { originalQuery, followUp }
// Rewrites a short follow-up ("3 more people", "add some from healthcare")
// typed into an already-open session into a complete, standalone Exa query —
// so "3 more people" becomes an actual request for more/different results
// against the same original criteria, not a fragment Exa's /search has to
// guess at. Uses GPT-5 nano (cheap, low-latency) since this is pure text
// rewriting, not research — no reason to spend an Exa Agent run on it.
//
// Fails open: if OPENAI_API_KEY isn't configured or the call errors, we
// return the follow-up text unchanged rather than blocking the search.

export async function POST(req: NextRequest) {
  const { originalQuery, followUp } = await req.json();
  if (!originalQuery || !followUp) {
    return NextResponse.json({ error: "missing originalQuery or followUp" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ expandedQuery: followUp, expanded: false });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content:
              "You rewrite short follow-up requests into complete, standalone search queries for a " +
              "semantic people-search API. You'll be given the ORIGINAL query that started this " +
              "conversation and a short FOLLOW-UP the user just typed. Produce ONE complete " +
              "natural-language query capturing what the user wants now, as if typed from scratch. " +
              'If the follow-up asks for more or different results (e.g. "3 more people", "more like ' +
              'this", "a few more"), rewrite it as a request for additional/different results matching ' +
              "the same original criteria — do not just repeat the original verbatim. If the follow-up " +
              "already reads as a complete, self-contained query, return it unchanged. " +
              "Reply with ONLY the rewritten query text — no quotes, no explanation.",
          },
          {
            role: "user",
            content: `Original query: "${originalQuery}"\nFollow-up: "${followUp}"`,
          },
        ],
        // No temperature override: gpt-5 family models reject any value but
        // the default (verified live — sending 0 was a 400 that our fail-open
        // path silently swallowed, so expansion never ran).
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ expandedQuery: followUp, expanded: false });
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return NextResponse.json({ expandedQuery: followUp, expanded: false });
    return NextResponse.json({ expandedQuery: text, expanded: text !== followUp });
  } catch {
    return NextResponse.json({ expandedQuery: followUp, expanded: false });
  }
}
