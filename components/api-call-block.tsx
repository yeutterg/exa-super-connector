"use client";

// Shared presentational block for "the actual call that fired" — used above
// the results table for the search call, and again in the brief/verify
// thread turns for the agent/runs call. Server routes call api.exa.ai
// directly over REST (no exa-js SDK in the request path), so this shows the
// real JSON body — not an SDK wrapper we don't actually use. Stats (results,
// cost, time, matches) live as pills near the data they describe, not here.

import { CodeBlock } from "@/components/code-block";
import { Pill } from "@/components/pill";

export function ApiCallBlock({
  json,
  path,
  tag,
}: {
  json: string;
  /** e.g. "/search" or "/agent/runs" — always POST in this app. */
  path: string;
  /** secondary descriptor, e.g. "category: people" or "Connect attached" */
  tag: string;
}) {
  return (
    <div className="rounded-lg border bg-card/50 px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Pill tone="blue">POST {path}</Pill>
        <Pill tone="neutral">{tag}</Pill>
      </div>
      <CodeBlock code={json} lang="json" />
    </div>
  );
}
