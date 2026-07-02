"use client";

// "Re-run with Agent" result, appended as its own thread turn below the
// table — /search can't express negation reliably, so this hands the same
// candidates to the Agent to actually research and verify each one.

import { useApp } from "@/lib/store";
import type { SearchRecord } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiCallBlock } from "@/components/api-call-block";
import { Pill } from "@/components/pill";
import { buildVerifyBody } from "@/lib/exa";
import { apiJsonSnippet } from "@/lib/snippets";
import { fmtUSD } from "@/lib/format";

export function VerifyThread({ record }: { record: SearchRecord }) {
  const { verifyResults, verifyLoadingId, verifyError } = useApp();

  const result = verifyResults[record.id];
  const loading = verifyLoadingId === record.id;
  if (!loading && !result && !verifyError) return null;

  const pendingBody = buildVerifyBody(record.query, record.people);

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Re-run with Agent · verifying {record.people.length} candidates
        </span>
        {result && (
          <>
            <Pill tone="green">
              {result.output.verified.filter((v) => v.matches).length}/
              {result.output.verified.length} match
            </Pill>
            <Pill tone="neutral">{(result.durationMs / 1000).toFixed(1)}s</Pill>
            <Pill tone="green">{fmtUSD(result.cost.total)}</Pill>
          </>
        )}
      </div>

      <ApiCallBlock
        json={apiJsonSnippet(loading || !result ? pendingBody : result.request)}
        path="/agent/runs"
        tag="web research only"
      />

      {loading ? (
        <div className="space-y-2 rounded-md border p-4">
          <div className="text-xs text-muted-foreground">
            Agent researching each candidate against the original query…
          </div>
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ) : result ? (
        <ul className="space-y-2 rounded-md border p-3">
          {result.output.verified.map((v) => {
            const person = record.people.find((p) => p.id === v.personId);
            return (
              <li key={v.personId} className="flex items-start gap-2 text-xs leading-relaxed">
                <Pill tone={v.matches ? "green" : "neutral"}>
                  {v.matches ? "Matches" : "Excluded"}
                </Pill>
                <span>
                  <span className="font-medium">{person?.name ?? v.personId}</span>
                  {" — "}
                  {v.reason}
                </span>
              </li>
            );
          })}
        </ul>
      ) : verifyError ? (
        <div className="rounded-md border border-destructive/40 p-3 text-xs text-muted-foreground">
          Verification unavailable: {verifyError}
        </div>
      ) : null}
    </div>
  );
}
