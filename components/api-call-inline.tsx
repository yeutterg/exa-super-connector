"use client";

// The search call, shown inline above its results — one per turn, not a
// persistent side panel. The Build Brief and Re-run-with-Agent calls get
// their own turns further down the thread rather than swapping this out.
// Result stats (count/category/cost/time) are pills at the top of the
// results table, not repeated here.

import type { SearchRecord } from "@/lib/types";
import { ApiCallBlock } from "@/components/api-call-block";
import { apiJsonSnippet } from "@/lib/snippets";

export function ApiCallInline({ record }: { record: SearchRecord }) {
  return (
    <div className="mb-4">
      <ApiCallBlock
        json={apiJsonSnippet(record.request)}
        path="/search"
        tag={`category: ${record.request.category}`}
      />
    </div>
  );
}
