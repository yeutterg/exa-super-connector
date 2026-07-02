"use client";

// Results table with Structured / Raw toggle (must-have #2). Rows are
// self-contained — no detail panel (scope guardrail #1); the full entities[]
// payload is one click away in Raw. Non-people turns (re-runs against
// company/news/web corpora) render a source list + extracted findings
// instead of the people table.

import { ExternalLink } from "lucide-react";
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
          <Pill tone="neutral">
            {hasPeople ? record.people.length : record.response.results.length}{" "}
            results
          </Pill>
          <Pill tone="blue">{record.request.category ?? "web"}</Pill>
          <Pill tone="neutral">{record.request.type}</Pill>
          {/* Multi-call turns (deep + join fan-out) show the whole-turn cost;
              the tooltip carries the API's own breakdown. */}
          <span
            title={
              record.turnCostDollars !== undefined
                ? `deep ${fmtUSD(record.response.costDollars?.total ?? 0)} + joins ${fmtUSD(
                    record.turnCostDollars -
                      (record.response.costDollars?.total ?? 0),
                  )} — real costDollars from each response`
                : record.response.costDollars?.search
                  ? `costDollars.search: ${JSON.stringify(record.response.costDollars.search)}`
                  : undefined
            }
          >
            <Pill tone="green">
              {fmtUSD(
                record.turnCostDollars ??
                  record.response.costDollars?.total ??
                  0,
              )}
            </Pill>
          </span>
          <span
            title={
              record.response.searchTime !== undefined
                ? `Exa-reported searchTime: ${(record.response.searchTime / 1000).toFixed(1)}s · shown: full round trip`
                : undefined
            }
          >
            <Pill tone="neutral">{(record.durationMs / 1000).toFixed(1)}s</Pill>
          </span>
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
              // Disable while ANY pipeline is running — the guard in the
              // store already no-ops, but the button should show it.
              disabled={Boolean(rerunningDeepId) || searchLoading}
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
                    recordId={record.id}
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
  recordId,
  loading,
  active,
  onBrief,
}: {
  person: Person;
  recordId: string;
  loading: boolean;
  active: boolean;
  onBrief: () => void;
}) {
  const { runContents } = useApp();
  return (
    <TableRow className={active ? "bg-accent/60 hover:bg-accent/60" : undefined}>
      <TableCell>
        {/* The whole person cell opens the profile drawer, not just the name
            text — clicking the avatar or the empty space around it should
            work too. The external link stays a separate nested target. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => runContents(person, recordId)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") runContents(person, recordId);
          }}
          title="Extract this profile via /contents"
          className="group flex cursor-pointer items-center gap-2.5"
        >
          <Avatar className="size-8">
            {person.image && <AvatarImage src={person.image} alt="" />}
            <AvatarFallback className="text-[10px]">
              {initials(person.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <span className="text-xs font-medium group-hover:underline">
              {person.name}
            </span>
            <a
              href={person.url}
              target="_blank"
              rel="noreferrer"
              title="Open source profile"
              onClick={(e) => e.stopPropagation()}
              className="ml-1 inline-flex align-middle opacity-0 transition-opacity group-hover:opacity-100"
            >
              <ExternalLink className="size-3 text-muted-foreground hover:text-foreground" />
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
