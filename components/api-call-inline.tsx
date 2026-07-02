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
          record.request.category
            ? `category: ${record.request.category}`
            : `${record.request.type} · web-wide`
        }
      />
      {record.joinRequest && (
        <ApiCallBlock
          json={apiJsonSnippet(record.joinRequest)}
          path="/search"
          tag="join · people at extracted companies"
        />
      )}
    </div>
  );
}
