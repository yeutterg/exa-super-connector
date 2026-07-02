"use client";

// Center column: scrolling session area — a stack of appended turns (empty
// state, or one block per SearchRecord in the active session), with the
// search bar fixed at the bottom. Typing while a session is open appends a
// new turn instead of replacing the view; the first query stays pinned to
// the top as the session's title.

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useApp } from "@/lib/store";
import type { SearchRecord } from "@/lib/types";
import { HERO_QUERIES } from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResultsSkeleton, ResultsTable } from "@/components/results-table";
import { ApiCallInline } from "@/components/api-call-inline";
import { BriefThread } from "@/components/brief-thread";
import { VerifyThread } from "@/components/verify-thread";
import { AsciiWordmark } from "@/components/ascii-logo";
import { CostMeter } from "@/components/cost-meter";

export function SearchPanel() {
  const {
    activeTurns,
    searchLoading,
    searchError,
    runQuery,
    openBriefPersonId,
    briefLoadingId,
    briefs,
    verifyLoadingId,
    verifyResults,
  } = useApp();
  const [value, setValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom as new turns are appended to the thread — new
  // search results, opening a brief, a brief completing, or a verify pass.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [
    activeTurns.length,
    searchLoading,
    openBriefPersonId,
    briefLoadingId,
    briefs,
    verifyLoadingId,
    verifyResults,
  ]);

  const submit = (q: string) => {
    if (!q.trim() || searchLoading) return;
    setValue("");
    void runQuery(q);
  };

  const hasTurns = activeTurns.length > 0;

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col">
      {!hasTurns && (
        <div className="absolute top-3 right-4 z-10">
          <CostMeter />
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {hasTurns ? (
          <>
            {activeTurns.map((record, i) => (
              <Turn key={record.id} record={record} pinned={i === 0} />
            ))}
            {searchLoading && (
              <div className="px-6 py-6">
                <ResultsSkeleton />
              </div>
            )}
            {searchError && !searchLoading && (
              <div className="mx-6 my-4 rounded-md border border-destructive/40 p-3 text-xs text-muted-foreground">
                Re-run failed: {searchError}
              </div>
            )}
          </>
        ) : searchLoading ? (
          <div className="px-6 py-6">
            <ResultsSkeleton />
          </div>
        ) : (
          <div className="h-full px-6 py-6">
            <EmptyState />
          </div>
        )}
      </div>

      <div className="border-t px-6 py-4">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {HERO_QUERIES.map((q) => (
            <Button
              key={q}
              variant="secondary"
              size="xs"
              className="rounded-full font-normal"
              disabled={searchLoading}
              onClick={() => submit(q)}
            >
              {q}
            </Button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(value);
          }}
          className="relative"
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              hasTurns
                ? "Expand the search or ask something new…"
                : "Try: 'Series B companies that are rapidly scaling their GTM team'"
            }
            className="h-10 pr-11"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!value.trim() || searchLoading}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full"
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}

function Turn({ record, pinned }: { record: SearchRecord; pinned: boolean }) {
  return (
    <>
      {pinned ? (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-3">
          <h2 className="text-sm font-semibold">{record.query}</h2>
          <CostMeter />
        </div>
      ) : (
        <h2 className="border-b px-6 py-3 text-sm font-semibold">{record.query}</h2>
      )}
      <div className="px-6 py-6">
        <ApiCallInline record={record} />
        <ResultsTable record={record} />
        <VerifyThread record={record} />
        <BriefThread record={record} />
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <AsciiWordmark />
    </div>
  );
}
