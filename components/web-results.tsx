"use client";

// Rendering for deep-search extras and non-people turns. When a deep run
// carried an outputSchema, the structured findings render as a table
// mirroring the people table; the raw sources are a secondary list below.

import type { SearchRecord } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pill } from "@/components/pill";

export function FindingsTable({ record }: { record: SearchRecord }) {
  const findings = record.response.output?.content?.findings;
  if (!findings?.length) return null;

  return (
    <Table className="table-fixed [&_td]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[18%]">Entity</TableHead>
          <TableHead className="w-[57%]">Why it matches</TableHead>
          <TableHead className="w-[25%]">Evidence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.map((f, i) => (
          <TableRow key={i}>
            <TableCell className="text-xs font-medium">{f.entity}</TableCell>
            <TableCell className="text-xs leading-relaxed text-muted-foreground">
              {f.note ?? "—"}
            </TableCell>
            <TableCell className="text-xs leading-relaxed text-muted-foreground">
              {/* On the people corpus the synthesis sometimes returns prose
                  here instead of a URL — only link real links. */}
              {/^https?:\/\//.test(f.evidence) ? (
                <a
                  href={f.evidence}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted underline-offset-2"
                >
                  {safeHostname(f.evidence)}
                </a>
              ) : (
                <span className="line-clamp-3">{f.evidence}</span>
              )}
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
