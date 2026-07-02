"use client";

// Center column: scrolling session area — a stack of appended turns (empty
// state, or one block per SearchRecord in the active session), with the
// search bar fixed at the bottom. Typing while a session is open appends a
// new turn instead of replacing the view; the first query stays pinned to
// the top as the session's title. Each turn heading is a permalink anchor
// (/s/<sessionId>#<recordId>) — a hash in the URL scrolls to that turn on
// load instead of snapping to the bottom.

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Link as LinkIcon } from "lucide-react";
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

// Hero queries replay cached fixtures (demo-safe); the extras run live.
const SUGGESTED_QUERIES = [
  ...HERO_QUERIES,
  "VPs and above at Meta",
  "Sound Engineers at Apple",
];

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
    rerunningDeepId,
    pipelineStage,
  } = useApp();
  const [value, setValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // A #recordId fragment on first load wins over scroll-to-bottom, once.
  const pendingHashRef = useRef<string | null>(
    typeof window !== "undefined" && window.location.hash
      ? decodeURIComponent(window.location.hash.slice(1))
      : null,
  );

  // Auto-scroll to the bottom as new turns are appended to the thread — new
  // search results, opening a brief, a brief completing, a verify pass, or
  // the instant "Re-run as deep" is clicked (rerunningDeepId flips before
  // the skeleton exists, so the jump feels immediate).
  useEffect(() => {
    const pending = pendingHashRef.current;
    if (pending && activeTurns.length > 0) {
      pendingHashRef.current = null; // one attempt — stale links fall through
      const el = document.getElementById(pending);
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
    }
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
    rerunningDeepId,
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
                {pipelineStage && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {pipelineStage}
                  </p>
                )}
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
        {/* Suggested queries only make sense before a session exists — once
            a chat is open, the input is for follow-ups. */}
        {!hasTurns && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {SUGGESTED_QUERIES.map((q) => (
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
        )}
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

/** Hover-revealed permalink button — copies /s/<sessionId>#<recordId> and
 *  sets the fragment so the address bar reflects the linked turn. */
function PermalinkButton({ recordId }: { recordId: string }) {
  const { activeSessionId } = useApp();
  const [copied, setCopied] = useState(false);
  if (!activeSessionId) return null;

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/s/${encodeURIComponent(activeSessionId)}#${encodeURIComponent(recordId)}`;
    await navigator.clipboard.writeText(url);
    window.history.replaceState(null, "", url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy link to this message"
      className="inline-flex opacity-0 transition-opacity group-hover:opacity-100"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <LinkIcon className="size-3.5 text-muted-foreground hover:text-foreground" />
      )}
    </button>
  );
}

function Turn({ record, pinned }: { record: SearchRecord; pinned: boolean }) {
  return (
    <>
      {pinned ? (
        <div
          id={record.id}
          className="group sticky top-0 z-10 flex scroll-mt-2 items-center justify-between border-b bg-background px-6 py-3"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {record.query}
            <PermalinkButton recordId={record.id} />
          </h2>
          <CostMeter />
        </div>
      ) : (
        <h2
          id={record.id}
          className="group flex scroll-mt-14 items-center gap-2 border-b px-6 py-3 text-sm font-semibold"
        >
          {record.query}
          <PermalinkButton recordId={record.id} />
        </h2>
      )}
      <div className="px-6 py-6">
        {record.rawInput && record.rawInput !== record.query && (
          <p className="mb-3 text-[11px] text-muted-foreground">
            Query rewritten by gpt-5-nano — original:{" "}
            <span className="italic">&ldquo;{record.rawInput}&rdquo;</span>
          </p>
        )}
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
