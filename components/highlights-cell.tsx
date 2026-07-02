"use client";

// Table cell showing the first highlight (truncated) with a hover-revealed
// expand button that opens all of a person's highlights, rendered as
// markdown — Exa's highlight text often comes back with headers, bold, and
// links (e.g. "### Founder at ... (Current)"), so raw text throws that away.

import { Expand } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Person } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function HighlightsCell({ person }: { person: Person }) {
  return (
    <div className="group flex items-start gap-1.5">
      <span className="line-clamp-3 flex-1">{person.highlight}</span>
      {person.highlights.length > 0 && (
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                title="Expand all highlights"
                className="mt-0.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              />
            }
          >
            <Expand className="size-3 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-h-[420px] w-[420px] max-w-[90vw] overflow-y-auto"
          >
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {person.name} · all highlights
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_h1]:text-xs [&_h2]:text-xs [&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold [&_p]:my-1">
              {person.highlights.map((h, i) => (
                <ReactMarkdown key={i}>{h}</ReactMarkdown>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
