"use client";

// Rendering for non-people turns (company/news/web re-runs). When the deep
// run carried an outputSchema, the structured findings ARE the data — they
// get the first-class table treatment (mirroring the people table), with the
// raw sources demoted to a secondary list. Each finding row has a "Find
// people" button that fires the join (people search at that company) as a
// new turn.

import { ArrowRight } from "lucide-react";
import { useApp } from "@/lib/store";
import type { SearchRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pill } from "@/components/pill";
import { buildPeopleAtCompanyQuery } from "@/lib/exa";

export function FindingsTable({ record }: { record: SearchRecord }) {
  const { runQuery, searchLoading } = useApp();
  const findings = record.response.output?.content?.findings;
  if (!findings?.length) return null;

  return (
    <Table className="table-fixed [&_td]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[18%]">Entity</TableHead>
          <TableHead className="w-[52%]">Why it matches</TableHead>
          <TableHead className="w-[15%]">Evidence</TableHead>
          <TableHead className="w-[15%]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.map((f, i) => (
          <TableRow key={i}>
            <TableCell className="text-xs font-medium">{f.entity}</TableCell>
            <TableCell className="text-xs leading-relaxed text-muted-foreground">
              {f.note ?? "—"}
            </TableCell>
            <TableCell className="text-xs">
              <a
                href={f.evidence}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground underline decoration-dotted underline-offset-2"
              >
                {safeHostname(f.evidence)}
              </a>
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="xs"
                variant="outline"
                disabled={searchLoading}
                onClick={() => runQuery(buildPeopleAtCompanyQuery(f.entity))}
                title="The join: feed this company back into fast people search"
              >
                Find people <ArrowRight className="size-3" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WebResultsList({ record }: { record: SearchRecord }) {
  return (
    <ul className="divide-y rounded-md border">
      {record.response.results.map((r) => (
        <li key={r.id} className="px-3 py-2.5 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium hover:underline"
            >
              {r.title || r.url}
            </a>
            {r.publishedDate && (
              <Pill tone="neutral">{r.publishedDate.slice(0, 10)}</Pill>
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {safeHostname(r.url)}
          </div>
          {r.highlights?.[0] && (
            <p className="mt-1 line-clamp-2 leading-relaxed text-muted-foreground">
              {r.highlights[0]}
            </p>
          )}
        </li>
      ))}
      {record.response.results.length === 0 && (
        <li className="px-3 py-4 text-center text-xs text-muted-foreground">
          No results for this configuration.
        </li>
      )}
    </ul>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40);
  }
}
