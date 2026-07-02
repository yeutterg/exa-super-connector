import { NextRequest, NextResponse } from "next/server";

// POST /api/expand-query { originalQuery, followUp, shownPeople? }
// Rewrites a short follow-up ("Show 10 more profiles", "add some from
// healthcare") typed into an already-open session into a structured edit:
// a complete standalone query PLUS an optional numResults. Uses GPT-5 nano
// (cheap text editing, not research).
//
// Exclusion of already-shown people is deliberately NOT done in the query
// text — dense embeddings can't reliably encode "not these people" (the same
// negation weakness this app demonstrates), so the client filters seen ids
// deterministically and over-fetches to compensate. shownPeople is passed
// only so the rewrite can phrase intent naturally ("additional profiles").
//
// Fails open: if OPENAI_API_KEY isn't configured or the call errors, we
// return the follow-up text unchanged rather than blocking the search.

export async function POST(req: NextRequest) {
  const { originalQuery, followUp, shownPeople } = await req.json();
  if (!originalQuery || !followUp) {
    return NextResponse.json({ error: "missing originalQuery or followUp" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ expandedQuery: followUp, numResults: null, expanded: false });
  }

  const shownList = Array.isArray(shownPeople)
    ? shownPeople.slice(0, 30).join(", ")
    : "";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You edit search requests for a semantic people-search API. You'll be given the " +
              "ORIGINAL query that started this session, a short FOLLOW-UP the user just typed, and " +
              "optionally the people already shown. Reply with ONLY a JSON object: " +
              '{"query": string, "numResults": number | null}. ' +
              "query: one complete standalone natural-language query capturing what the user wants " +
              "now. If the follow-up asks for more/additional results, phrase it as a fresh request " +
              "for the same criteria (e.g. \"additional …\") — but NEVER enumerate excluded names in " +
              "the query; the app filters already-shown people itself. " +
              "numResults: if the follow-up specifies or implies a count (\"10 more\", \"show me 25\"), " +
              "set it (1-100); otherwise null. " +
              "If the follow-up already reads as a complete query with no count, return it unchanged " +
              "with numResults null.",
          },
          {
            role: "user",
            content:
              `Original query: "${originalQuery}"\n` +
              (shownList ? `Already shown: ${shownList}\n` : "") +
              `Follow-up: "${followUp}"`,
          },
        ],
        // No temperature override: gpt-5 family models reject any value but
        // the default (verified live — sending 0 was a 400 that our fail-open
        // path silently swallowed, so expansion never ran).
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ expandedQuery: followUp, numResults: null, expanded: false });
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({ expandedQuery: followUp, numResults: null, expanded: false });
    }
    const parsed = JSON.parse(text) as { query?: string; numResults?: number | null };
    const expandedQuery =
      typeof parsed.query === "string" && parsed.query.trim() ? parsed.query.trim() : followUp;
    const numResults =
      typeof parsed.numResults === "number"
        ? Math.min(Math.max(Math.round(parsed.numResults), 1), 100)
        : null;
    return NextResponse.json({
      expandedQuery,
      numResults,
      expanded: expandedQuery !== followUp || numResults !== null,
    });
  } catch {
    return NextResponse.json({ expandedQuery: followUp, numResults: null, expanded: false });
  }
}
