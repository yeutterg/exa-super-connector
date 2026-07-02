"use client";

// Rendering for non-people turns (company/news/web re-runs): a source list
// instead of the people table, plus — when the deep run carried an
// outputSchema — the structured findings with a per-entity "Find people"
// button that fires the join (people search at that company) as a new turn.

import { ArrowRight } from "lucide-react";
import { useApp } from "@/lib/store";
import type { SearchRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/pill";
import { buildPeopleAtCompanyQuery } from "@/lib/exa";

export function FindingsCard({ record }: { record: SearchRecord }) {
  const { runQuery, searchLoading } = useApp();
  const findings = record.response.output?.content?.findings;
  if (!findings?.length) return null;

  return (
    <Card className="mb-3 border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Extracted entities{" "}
          <span className="font-normal text-muted-foreground">
            — structured synthesis from deep search, one citation each
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {findings.map((f, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-xs">
              <span className="leading-relaxed">
                <span className="font-medium">{f.entity}</span>
                {f.note && <span className="text-muted-foreground"> — {f.note}</span>}{" "}
                <a
                  href={f.evidence}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground underline decoration-dotted underline-offset-2"
                >
                  {safeHostname(f.evidence)}
                </a>
              </span>
              <Button
                size="xs"
                variant="outline"
                className="shrink-0"
                disabled={searchLoading}
                onClick={() => runQuery(buildPeopleAtCompanyQuery(f.entity))}
                title="The join: feed this company back into fast people search"
              >
                Find people <ArrowRight className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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
