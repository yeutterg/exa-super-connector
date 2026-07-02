import { NextRequest, NextResponse } from "next/server";
import { buildBriefBody } from "@/lib/exa";
import {
  createAndPollAgentRun,
  extractRoutedTo,
  extractRunCost,
  extractStructuredOutput,
  type Json,
} from "@/lib/agent-run";
import type { BriefOutput, WhyNowSignal } from "@/lib/types";

// POST /api/brief { person: { name, title, company } }
// Creates an Exa Agent run with Connect providers attached (auto-routed), polls
// to completion, and returns the structured output + attributed cost.
//
// Real /agent/runs response shape (confirmed against live calls):
//   output.structured        — the outputSchema-conforming object
//   output.grounding[]        — per-field citations (not used here; we already
//                               get a citation URL per whyNow item from the
//                               schema itself)
//   costDollars: { total, agentCompute, search, dataSources: { <provider>: $ } }
// There is no per-signal "which provider supplied this" field — the only
// honest attribution is at the run level, from costDollars.dataSources keys.

function toBriefOutput(o: Json): BriefOutput | null {
  if (!("email" in o || "whyNow" in o)) return null;
  return {
    email: typeof o.email === "string" ? o.email : null,
    whyNow: Array.isArray(o.whyNow)
      ? (o.whyNow as WhyNowSignal[]).map((s) => ({
          signal: String(s.signal ?? ""),
          source: String(s.source ?? ""),
          date: String(s.date ?? ""),
        }))
      : [],
  };
}

export async function POST(req: NextRequest) {
  const { person } = await req.json();
  if (!person?.name || !person?.company) {
    return NextResponse.json({ error: "missing person" }, { status: 400 });
  }

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "EXA_API_KEY not configured" },
      { status: 503 },
    );
  }

  const body = buildBriefBody(person);
  const started = Date.now();
  try {
    const { run, error, status } = await createAndPollAgentRun(apiKey, body);
    if (error) return NextResponse.json({ error }, { status: status ?? 502 });

    const structured = extractStructuredOutput(run);
    const output = structured && toBriefOutput(structured);
    if (!output) {
      return NextResponse.json(
        { error: "agent run returned no structured output", raw: run },
        { status: 502 },
      );
    }
    return NextResponse.json({
      request: body,
      output,
      routedTo: extractRoutedTo(run),
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
