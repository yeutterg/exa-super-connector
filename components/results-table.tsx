"use client";

// Results table with Structured / Raw toggle (must-have #2). Rows are
// self-contained — no detail panel (scope guardrail #1); the full entities[]
// payload is one click away in Raw. Non-people turns (re-runs against
// company/news/web corpora) render a source list + extracted findings
// instead of the people table.

import { useApp } from "@/lib/store";
import type { Person, SearchRecord } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CodeBlock } from "@/components/code-block";
import { Pill } from "@/components/pill";
import { HighlightsCell } from "@/components/highlights-cell";
import { FindingsTable, WebResultsList } from "@/components/web-results";
import { fmtUSD } from "@/lib/format";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultsTable({ record }: { record: SearchRecord }) {
  const {
    rawView,
    setRawView,
    runBrief,
    openBriefPersonId,
    briefLoadingId,
    runVerify,
    verifyLoadingId,
    rerunAsDeep,
    rerunningDeepId,
    searchLoading,
  } = useApp();
  const verifying = verifyLoadingId === record.id;
  const rewriting = rerunningDeepId === record.id;
  // Deep pipeline turns are web-scoped but carry join-derived people — gate
  // the people table on actual people, not on the request category.
  const hasPeople = record.people.length > 0;
  const isDeepAlready = record.request.type.startsWith("deep");
  const hasFindings = Boolean(record.response.output?.content?.findings?.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Pill tone="neutral">{record.response.results.length} results</Pill>
          <Pill tone="blue">{record.request.category ?? "web"}</Pill>
          <Pill tone="neutral">{record.request.type}</Pill>
          <Pill tone="green">
            {fmtUSD(record.response.costDollars?.total ?? 0)}
          </Pill>
          <Pill tone="neutral">{(record.durationMs / 1000).toFixed(1)}s</Pill>
        </div>
        <div className="flex items-center gap-2">
          {hasPeople && (
            <Button
              variant="outline"
              size="xs"
              disabled={verifying}
              onClick={() => runVerify(record)}
              title="Have the Agent research and verify each result against the query — catches what semantic search can't (like negation)"
            >
              {verifying ? "Verifying…" : "Verify with Agent"}
            </Button>
          )}
          {!isDeepAlready && (
            <Button
              variant="outline"
              size="xs"
              disabled={rewriting || searchLoading}
              onClick={() => rerunAsDeep(record)}
              title="GPT-5 nano rewrites the query into deep-search format (comma-separated constraints), then re-runs it as an agentic deep search with entity extraction"
            >
              {rewriting ? "Rewriting query…" : "Re-run as deep"}
            </Button>
          )}
          <div className="flex rounded-md border p-0.5">
            <Button
              variant={rawView ? "ghost" : "secondary"}
              size="xs"
              onClick={() => setRawView(false)}
            >
              Structured
            </Button>
            <Button
              variant={rawView ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setRawView(true)}
            >
              Raw
            </Button>
          </div>
        </div>
      </div>

      {rawView ? (
        <CodeBlock
          code={JSON.stringify(record.response, null, 2)}
          lang="json"
          maxHeightClassName="max-h-[70vh]"
        />
      ) : (
        <>
          {hasPeople && (
            <Table className="table-fixed [&_td]:whitespace-normal">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[21%]">Person</TableHead>
                  <TableHead className="w-[17%]">Title</TableHead>
                  <TableHead className="w-[15%]">Company</TableHead>
                  <TableHead className="w-[36%]">Highlights</TableHead>
                  <TableHead className="w-[11%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.people.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    loading={briefLoadingId === p.id}
                    active={openBriefPersonId === p.id}
                    onBrief={() => runBrief(p, record.id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
          {hasFindings && (
            // Deep run with structured output: rendered alongside the people
            // table (deep people re-runs) or as the primary data (web runs).
            <>
              <div className="pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Structured output
              </div>
              <FindingsTable record={record} />
            </>
          )}
          {(!hasPeople || isDeepAlready) && (
            <>
              <div className="pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Sources
              </div>
              <WebResultsList record={record} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function PersonRow({
  person,
  loading,
  active,
  onBrief,
}: {
  person: Person;
  loading: boolean;
  active: boolean;
  onBrief: () => void;
}) {
  return (
    <TableRow className={active ? "bg-accent/60 hover:bg-accent/60" : undefined}>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            {person.image && <AvatarImage src={person.image} alt="" />}
            <AvatarFallback className="text-[10px]">
              {initials(person.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <a
              href={person.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium hover:underline"
            >
              {person.name}
            </a>
            {person.location && (
              <div className="text-[10px] text-muted-foreground">
                {person.location}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs">{person.title}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-xs">
          {person.favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.favicon} alt="" className="size-3.5 rounded-sm" />
          )}
          {person.company}
        </div>
      </TableCell>
      <TableCell className="text-xs leading-relaxed text-muted-foreground">
        <HighlightsCell person={person} />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" disabled={loading} onClick={onBrief}>
          {loading ? "Building…" : "Build Brief"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
