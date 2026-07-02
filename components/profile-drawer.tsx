"use client";

// Half-width RIGHT drawer — the person hub, opened by "View Profile" (or
// clicking anywhere on a person cell). Two sections:
//   BRIEF   — /agent/runs with Connect attached: verified/inferred email +
//             grounded "why now" signals + a ready opener. Run on demand
//             (it's the expensive call); pre-warmed/cached briefs show
//             instantly.
//   PROFILE — Exa /contents extraction: steered summary, structured work
//             history (from the search result's entities[], no extra call),
//             and the raw page text. Fetched automatically (cheap) and
//             cached per person.

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiCallBlock } from "@/components/api-call-block";
import { BriefCard } from "@/components/brief-card";
import { CodeBlock } from "@/components/code-block";
import { CopyInline } from "@/components/copy-inline";
import { Pill } from "@/components/pill";
import { buildBriefBody } from "@/lib/exa";
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
    briefs,
    briefLoadingId,
    briefError,
    runBrief,
  } = useApp();
  const [showRaw, setShowRaw] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  const person = openContentsPersonId
    ? searches.flatMap((s) => s.people).find((p) => p.id === openContentsPersonId)
    : undefined;
  // Brief state for this person — cost attribution needs the search turn the
  // person came from (searches is newest-first, so [find] is the latest).
  const brief = openContentsPersonId ? briefs[openContentsPersonId] : undefined;
  const briefLoading = briefLoadingId === openContentsPersonId;
  const briefSearchId = searches.find((s) =>
    s.people.some((p) => p.id === openContentsPersonId),
  )?.id;

  // The brief runs automatically when the drawer opens — no button. Cached
  // briefs show instantly, so this fires the agent at most once per person;
  // briefError gates retries so a failed run doesn't loop.
  useEffect(() => {
    if (person && briefSearchId && !brief && !briefLoading && !briefError) {
      void runBrief(person, briefSearchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openContentsPersonId, Boolean(brief), briefLoading, briefError]);

  if (!openContentsPersonId) return null;
  const record = contentsRecords[openContentsPersonId];
  const loading = contentsLoadingId === openContentsPersonId;
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
              <button
                type="button"
                onClick={() => person.image && setImageOpen(true)}
                title={person.image ? "View larger photo" : undefined}
                className={person.image ? "cursor-zoom-in" : "cursor-default"}
              >
                <Avatar className="size-7">
                  <AvatarImage src={person.image ?? undefined} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {person.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
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
          {person && (
            <div className="space-y-0.5 pt-1 text-xs font-normal">
              <div className="group flex items-center gap-1.5">
                <span className="w-14 text-muted-foreground">Email</span>
                {brief?.output.email ? (
                  <>
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      {brief.output.email}
                    </code>
                    <CopyInline value={brief.output.email} />
                  </>
                ) : briefLoading ? (
                  <span className="animate-pulse text-muted-foreground">
                    fetching via agent…
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {brief ? "not found" : "—"}
                  </span>
                )}
              </div>
              <div className="group flex items-center gap-1.5">
                <span className="w-14 text-muted-foreground">LinkedIn</span>
                <a
                  href={person.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2"
                >
                  {person.url.replace(/^https?:\/\/(www\.)?/, "")}
                  <ExternalLink className="size-3 text-muted-foreground" />
                </a>
                <CopyInline value={person.url} />
              </div>
            </div>
          )}
        </SheetHeader>

        {/* [&>*]:shrink-0 — children of a scrollable flex column compress to
            fit before overflow kicks in; the brief card was getting squashed
            to its header instead of pushing content into the scroll. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 [&>*]:shrink-0">
          {/* ---------------- BRIEF (agent run, on demand) ---------------- */}
          {person && (
            <>
              <div className="border-b pb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Brief
                </span>
              </div>

              <ApiCallBlock
                json={apiJsonSnippet(brief ? brief.request : buildBriefBody(person))}
                path="/agent/runs"
                tag="Connect attached"
              />

              {briefLoading ? (
                <div className="space-y-2 rounded-md border p-4">
                  <div className="text-xs text-muted-foreground">
                    Agent run in flight — routing across Fiber.ai, Financial
                    Datasets, and Exa web research…
                  </div>
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ) : brief ? (
                <BriefCard person={person} brief={brief} />
              ) : briefError ? (
                <div className="rounded-md border border-destructive/40 p-3 text-xs text-muted-foreground">
                  Brief unavailable: {briefError}
                </div>
              ) : null}
            </>
          )}

          {/* ---------------- PROFILE (/contents extraction) ---------------- */}
          <div className="mt-2 border-b pb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Profile
            </span>
          </div>
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
                        Summary
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
                        Work history
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

        {/* Click the avatar → full-size photo */}
        {person?.image && (
          <Dialog open={imageOpen} onOpenChange={setImageOpen}>
            <DialogContent className="w-auto max-w-[80vw] p-2">
              <DialogTitle className="sr-only">
                {person.name} — photo
              </DialogTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={person.image}
                alt={person.name}
                className="max-h-[80vh] rounded-md object-contain"
              />
            </DialogContent>
          </Dialog>
        )}
      </SheetContent>
    </Sheet>
  );
}
