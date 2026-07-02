"use client";

// Half-width RIGHT drawer: clicking a person in any results table extracts
// their full profile via Exa /contents. The call that fired shows as code at
// the top with the familiar pill row (results/cost/time plus cached-vs-
// crawled provenance); the steered summary, structured work history (from
// the search result's entities[] — no extra call), and extracted page text
// render below. Cached per person — a second click reopens instantly with
// no new bill. Structured | Raw mirrors the results table and brief card.

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useApp } from "@/lib/store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiCallBlock } from "@/components/api-call-block";
import { CodeBlock } from "@/components/code-block";
import { Pill } from "@/components/pill";
import { apiJsonSnippet } from "@/lib/snippets";
import { fmtUSD } from "@/lib/format";

const PROSE_CLASSES =
  "prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-xs prose-headings:font-semibold prose-p:my-1 prose-a:decoration-dotted prose-a:underline-offset-2 prose-hr:my-2 prose-li:my-0.5 prose-ul:my-1";

export function ProfileDrawer() {
  const {
    openContentsPersonId,
    contentsRecords,
    contentsLoadingId,
    contentsError,
    closeContents,
    searches,
  } = useApp();
  const [showRaw, setShowRaw] = useState(false);

  if (!openContentsPersonId) return null;
  const record = contentsRecords[openContentsPersonId];
  const loading = contentsLoadingId === openContentsPersonId;
  const person = searches
    .flatMap((s) => s.people)
    .find((p) => p.id === openContentsPersonId);
  // People-category results already carry structured entities[] — surface the
  // work history the search returned, no extra call needed.
  const workHistory = searches
    .flatMap((s) => s.response.results)
    .find((r) => r.id === openContentsPersonId)?.entities?.[0]?.properties
    .workHistory;

  const doc = record?.response.results?.[0];
  const status = record?.response.statuses?.[0];

  return (
    <Sheet
      open={Boolean(openContentsPersonId)}
      onOpenChange={(open) => !open && closeContents()}
    >
      <SheetContent
        side="right"
        // The sheet's width defaults are variant-scoped (data-[side=right]:…),
        // so the overrides must be too — plain w-/max-w- classes lose.
        className="data-[side=right]:w-[50vw] data-[side=right]:sm:max-w-[50vw]"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2.5">
            {person && (
              <Avatar className="size-7">
                <AvatarImage src={person.image ?? undefined} alt="" />
                <AvatarFallback className="text-[10px]">
                  {person.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <span>
              {person?.name ?? record?.personName ?? "Profile"}
              {person && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {person.title} · {person.company}
                </span>
              )}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {record && (
            <>
              <ApiCallBlock
                json={apiJsonSnippet(record.request)}
                path="/contents"
                tag="profile extraction"
              />
              {/* Result stats + the Structured|Raw toggle live together below
                  the request code — the toggle switches the RESULTS view,
                  mirroring the results-table layout. */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Pill tone="neutral">
                    {record.response.results?.length ?? 0}{" "}
                    {(record.response.results?.length ?? 0) === 1
                      ? "result"
                      : "results"}
                  </Pill>
                  {status?.source && <Pill tone="blue">{status.source}</Pill>}
                  <Pill tone="green">
                    {fmtUSD(record.response.costDollars?.total ?? 0)}
                  </Pill>
                  <Pill tone="neutral">
                    {(record.durationMs / 1000).toFixed(1)}s
                  </Pill>
                </div>
                <div className="flex shrink-0 rounded-md border p-0.5">
                  <Button
                    variant={showRaw ? "ghost" : "secondary"}
                    size="xs"
                    onClick={() => setShowRaw(false)}
                  >
                    Structured
                  </Button>
                  <Button
                    variant={showRaw ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => setShowRaw(true)}
                    title="The complete /contents response body"
                  >
                    Raw
                  </Button>
                </div>
              </div>

              {showRaw ? (
                <CodeBlock
                  code={JSON.stringify(record.response, null, 2)}
                  lang="json"
                  maxHeightClassName="max-h-[70vh]"
                />
              ) : (
                <>
                  {doc?.summary && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Summary{" "}
                        <span className="font-normal normal-case tracking-normal">
                          — steered by summary.query in the request
                        </span>
                      </div>
                      <div
                        className={`${PROSE_CLASSES} rounded-md border bg-muted/40 p-3`}
                      >
                        <ReactMarkdown>{doc.summary}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {workHistory && workHistory.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Work history{" "}
                        <span className="font-normal normal-case tracking-normal">
                          — structured entities[] already on the search result,
                          no extra call
                        </span>
                      </div>
                      <ul className="divide-y rounded-md border">
                        {workHistory.slice(0, 8).map((w, i) => (
                          <li
                            key={i}
                            className="flex items-baseline justify-between gap-3 px-3 py-2 text-xs"
                          >
                            <span>
                              <span className="font-medium">{w.title}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                · {w.company.name}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {w.dates?.from?.slice(0, 7) ?? "…"} –{" "}
                              {w.dates?.to === null
                                ? "present"
                                : (w.dates?.to?.slice(0, 7) ?? "…")}
                            </span>
                          </li>
                        ))}
                        {workHistory.length > 8 && (
                          <li className="px-3 py-1.5 text-[10px] text-muted-foreground">
                            + {workHistory.length - 8} earlier roles (in Raw
                            view)
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {doc?.text && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Extracted profile
                      </div>
                      <div className={`${PROSE_CLASSES} rounded-md border p-3`}>
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noreferrer">
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {doc.text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {loading && (
            <div className="space-y-2 rounded-md border p-4">
              <div className="text-xs text-muted-foreground">
                Extracting profile via /contents…
              </div>
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          )}

          {contentsError && !loading && (
            <div className="rounded-md border border-destructive/40 p-3 text-xs text-muted-foreground">
              Profile extraction failed: {contentsError}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
