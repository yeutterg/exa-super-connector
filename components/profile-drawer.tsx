"use client";

// Half-width LEFT drawer (mirror of the call-history sheet on the right):
// clicking a person in any results table extracts their full profile via
// Exa /contents. The call that fired shows as code at the top with the
// familiar pill row (results/cost/time plus cached-vs-crawled provenance);
// the extracted summary and page text render below. Cached per person —
// a second click reopens instantly with no new bill.

import ReactMarkdown from "react-markdown";
import { useApp } from "@/lib/store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiCallBlock } from "@/components/api-call-block";
import { Pill } from "@/components/pill";
import { apiJsonSnippet } from "@/lib/snippets";
import { fmtUSD } from "@/lib/format";

export function ProfileDrawer() {
  const {
    openContentsPersonId,
    contentsRecords,
    contentsLoadingId,
    contentsError,
    closeContents,
    searches,
  } = useApp();

  if (!openContentsPersonId) return null;
  const record = contentsRecords[openContentsPersonId];
  const loading = contentsLoadingId === openContentsPersonId;
  const person = searches
    .flatMap((s) => s.people)
    .find((p) => p.id === openContentsPersonId);

  const doc = record?.response.results?.[0];
  const status = record?.response.statuses?.[0];

  return (
    <Sheet
      open={Boolean(openContentsPersonId)}
      onOpenChange={(open) => !open && closeContents()}
    >
      <SheetContent
        side="left"
        // The sheet's width defaults are variant-scoped (data-[side=left]:…),
        // so the overrides must be too — plain w-/max-w- classes lose.
        className="data-[side=left]:w-[50vw] data-[side=left]:sm:max-w-[50vw]"
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

              {doc?.summary && (
                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Summary
                  </div>
                  <p className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
                    {doc.summary}
                  </p>
                </div>
              )}

              {doc?.text && (
                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Extracted profile
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border p-3 text-xs leading-relaxed prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-xs prose-headings:font-semibold prose-p:my-1 prose-a:decoration-dotted prose-a:underline-offset-2 prose-hr:my-2 prose-li:my-0.5 prose-ul:my-1">
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
