"use client";

// The actual call(s) behind a turn, shown inline above the results. Deep
// pipeline turns made two: the deep web-wide extraction, then the people
// join at the extracted companies — both rendered so the composition stays
// visible. Result stats (count/category/cost/time) are pills at the top of
// the results table, not repeated here.

import type { SearchRecord } from "@/lib/types";
import { ApiCallBlock } from "@/components/api-call-block";
import { apiJsonSnippet } from "@/lib/snippets";

export function ApiCallInline({ record }: { record: SearchRecord }) {
  return (
    <div className="mb-4 space-y-3">
      {record.rewriteRequest && (
        <ApiCallBlock
          json={apiJsonSnippet(record.rewriteRequest)}
          path="/v1/chat/completions"
          tag="OpenAI · gpt-5-nano rewrites the query for deep search"
        />
      )}
      <ApiCallBlock
        json={apiJsonSnippet(record.request)}
        path="/search"
        tag={
          (record.request.category
            ? `category: ${record.request.category}`
            : `${record.request.type} · web-wide`) +
          (record.exclusion?.length
            ? ` · numResults +${record.exclusion.length} headroom for exclusion`
            : "")
        }
      />
      {record.exclusion && record.exclusion.length > 0 && (
        // /search has no exclusion parameter, and an embedding query can't
        // encode "not these people" — so exclusion is applied client-side by
        // result id, with the request over-fetched to compensate. Shown here
        // so the numResults math is visible instead of mysterious.
        <div className="rounded-lg border border-dashed px-4 py-3">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Exclusion list · applied client-side by result id
            {typeof record.excludedHits === "number" &&
              ` — ${record.excludedHits} fetched ${record.excludedHits === 1 ? "repeat" : "repeats"} dropped`}
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
            /search has no exclusion parameter, and embedding queries can&apos;t
            reliably encode &ldquo;not these people&rdquo; — so the request asks
            for {record.request.numResults} ({record.people.length} wanted +{" "}
            {record.exclusion.length} already shown) and the app filters:
          </p>
          <div className="flex flex-wrap gap-1">
            {record.exclusion.map((p) => (
              <span
                key={p.id}
                title={p.company}
                className="rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground line-through decoration-muted-foreground/50"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {record.joinRequests?.length ? (
        // The fan-out join: one focused query per extracted company, run in
        // parallel. Show the first body; the tag carries the count — the
        // other calls differ only in the company name.
        <ApiCallBlock
          json={apiJsonSnippet(record.joinRequests[0])}
          path="/search"
          tag={`join ×${record.joinRequests.length} · one leader per company, in parallel`}
        />
      ) : record.joinRequest ? (
        <ApiCallBlock
          json={apiJsonSnippet(record.joinRequest)}
          path="/search"
          tag="join · people at extracted companies"
        />
      ) : null}
    </div>
  );
}
