import { NextRequest, NextResponse } from "next/server";
import { buildVerifyBody } from "@/lib/exa";

// Agent runs poll up to ~110s — keep the serverless function alive that long.
export const maxDuration = 120;
import {
  createAndPollAgentRun,
  extractRunCost,
  extractStructuredOutput,
  type Json,
} from "@/lib/agent-run";
import type { VerifiedCandidate, VerifyOutput } from "@/lib/types";

// POST /api/verify { query, people: [{ id, name, title, company }] }
// "Re-run with Agent" — /search can't express negation reliably (embeddings
// don't encode "not"), so this hands the same candidates to the Agent, which
// actually researches and verifies each one against the full query, the same
// boolean-verification pattern Exa's own docs use (company_verified_as_exa_ai,
// identity_verified, etc). No Connect providers attached — pure web research.

function toVerifyOutput(o: Json): VerifyOutput | null {
  if (!Array.isArray(o.verified)) return null;
  return {
    verified: (o.verified as VerifiedCandidate[]).map((v) => ({
      personId: String(v.personId ?? ""),
      matches: Boolean(v.matches),
      reason: String(v.reason ?? ""),
    })),
  };
}

export async function POST(req: NextRequest) {
  const { query, people } = await req.json();
  if (!query || !Array.isArray(people) || people.length === 0) {
    return NextResponse.json({ error: "missing query or people" }, { status: 400 });
  }

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "EXA_API_KEY not configured" },
      { status: 503 },
    );
  }

  const body = buildVerifyBody(query, people);
  const started = Date.now();
  try {
    const { run, error, status } = await createAndPollAgentRun(apiKey, body);
    if (error) return NextResponse.json({ error }, { status: status ?? 502 });

    const structured = extractStructuredOutput(run);
    const output = structured && toVerifyOutput(structured);
    if (!output) {
      return NextResponse.json(
        { error: "agent run returned no structured output", raw: run },
        { status: 502 },
      );
    }
    return NextResponse.json({
      request: body,
      output,
      cost: extractRunCost(run),
      durationMs: Date.now() - started,
      raw: run,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "request failed" },
      { status: 502 },
    );
  }
}
