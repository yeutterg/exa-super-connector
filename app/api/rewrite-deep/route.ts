import { NextRequest, NextResponse } from "next/server";

// POST /api/rewrite-deep { query }
// Rewrites a conversational people-search query into deep-search format: a
// precise, comma-separated list of constraints plus what to return. Deep
// search decomposes the query agentically — explicit, enumerable constraints
// decompose better than prose. Uses GPT-5 nano (cheap text rewriting, not
// research). Fails open: no key / API error returns the query unchanged.

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ rewritten: query, rewrote: false });
  }

  // The exact body sent to OpenAI (sans auth header) — returned so the UI
  // can show this call as a code block in the deep-re-run turn.
  const openaiBody = {
    model: "gpt-5-nano",
    messages: [
      {
        role: "system",
        content:
          "You rewrite search queries for an agentic deep-research engine. Rewrite the user's " +
          "query as a precise, comma-separated list of explicit constraints, ending with what " +
          "to return. Keep EVERY constraint from the original — do not add or drop criteria. " +
          'Example: "Sales leaders at Series B SaaS companies hiring their first RevOps role" ' +
          '→ "SaaS companies, raised a Series B, currently hiring their first Revenue Operations ' +
          'role, return the sales or revenue leader at each company". ' +
          "Reply with ONLY the rewritten query — no quotes, no explanation.",
      },
      { role: "user", content: query },
    ],
    // gpt-5 family models reject non-default temperature — omit it.
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openaiBody),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ rewritten: query, rewrote: false });
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim()?.replace(/^"|"$/g, "");
    if (!text) return NextResponse.json({ rewritten: query, rewrote: false });
    return NextResponse.json({
      rewritten: text,
      rewrote: text !== query,
      request: openaiBody,
    });
  } catch {
    return NextResponse.json({ rewritten: query, rewrote: false });
  }
}
