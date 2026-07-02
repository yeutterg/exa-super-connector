"use client";

// Build Brief as a continuation of the thread, not a row expansion: the
// query to Exa Connect appears as its own code turn, followed by the
// resulting data — appended below the results, not nested inside the table.

import { useApp } from "@/lib/store";
import type { SearchRecord } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiCallBlock } from "@/components/api-call-block";
import { BriefCard } from "@/components/brief-card";
import { buildBriefBody } from "@/lib/exa";
import { apiJsonSnippet } from "@/lib/snippets";

export function BriefThread({ record }: { record: SearchRecord }) {
  const { openBriefPersonId, briefs, briefLoadingId, briefError, closeBrief } =
    useApp();

  if (!openBriefPersonId) return null;
  const person = record.people.find((p) => p.id === openBriefPersonId);
  if (!person) return null;

  const brief = briefs[openBriefPersonId];
  const loading = briefLoadingId === openBriefPersonId;

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Build Brief · {person.name}
      </div>

      <ApiCallBlock
        json={apiJsonSnippet(loading || !brief ? buildBriefBody(person) : brief.request)}
        path="/agent/runs"
        tag="Connect attached"
      />

      {loading ? (
        <div className="space-y-2 rounded-md border p-4">
          <div className="text-xs text-muted-foreground">
            Agent run in flight — routing across Fiber.ai, Financial Datasets,
            and Exa web research…
          </div>
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ) : brief ? (
        <BriefCard person={person} brief={brief} onClose={closeBrief} />
      ) : briefError ? (
        <div className="rounded-md border border-destructive/40 p-3 text-xs text-muted-foreground">
          Brief unavailable: {briefError}
        </div>
      ) : null}
    </div>
  );
}
