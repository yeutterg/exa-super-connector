"use client";

// Highlights column. Exa's highlight strings are fragment lists — excerpts
// joined by "\n...\n" separators — written in markdown (### headings, links,
// bold). Both views render that markdown properly instead of showing raw
// syntax: the table preview flattens blocks to inline text (a heading in a
// 3-line clamp would be chaos), and the hover-expanded popover renders the
// full structured document with typography styling, one section per
// fragment, plus a profile link.

import type { ComponentProps } from "react";
import { Expand, ExternalLink } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import type { Person } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Exa's excerpting can cut a fragment mid-link ("[Paid](https://linkedin…" /
 *  "…paid-ai)"), leaving dangling markdown that renders as raw syntax. Repair
 *  what's repairable and drop the noise. */
function sanitizeFragment(f: string): string {
  return (
    f
      // dangling link start at end of fragment: keep the label, drop the cut URL
      .replace(/\[([^\]]*)\]\([^)]*$/, "$1")
      // orphaned URL tail at the start of a fragment (the other half of a cut link)
      .replace(/^[\w./-]{1,60}\)\s*/, "")
      .trim()
  );
}

/** "frag one\n...\nfrag two" → markdown with each fragment its own block,
 *  separated by horizontal rules (styled subtly by prose-hr). */
function toStructuredMarkdown(highlight: string): string {
  return highlight
    .split(/\n?\s*\.\.\.\s*\n?/)
    .map((f) => sanitizeFragment(f))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

/** Fragments joined inline for the clamped preview. Complete links flatten to
 *  their text — a 3-line glanceable cell isn't the place to click through. */
function toInlineMarkdown(highlight: string): string {
  return highlight
    .split(/\n?\s*\.\.\.\s*\n?/)
    .map((f) =>
      sanitizeFragment(f)
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/^#+\s*/, ""),
    )
    .filter(Boolean)
    .join(" · ");
}

const linkComponent = {
  a: ({ href, children }: ComponentProps<"a">) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="underline decoration-dotted underline-offset-2"
    >
      {children}
    </a>
  ),
};

// Preview: flatten every block element to an inline span so bold/links render
// without headings or paragraphs breaking the 3-line clamp.
const inlineComponents: Components = {
  ...linkComponent,
  p: ({ children }) => <span>{children} </span>,
  h1: ({ children }) => <span className="font-medium">{children} </span>,
  h2: ({ children }) => <span className="font-medium">{children} </span>,
  h3: ({ children }) => <span className="font-medium">{children} </span>,
  h4: ({ children }) => <span className="font-medium">{children} </span>,
  ul: ({ children }) => <span>{children}</span>,
  ol: ({ children }) => <span>{children}</span>,
  li: ({ children }) => <span>• {children} </span>,
  hr: () => <span className="text-muted-foreground/60"> · </span>,
  blockquote: ({ children }) => <span>{children}</span>,
};

export function HighlightsCell({ person }: { person: Person }) {
  return (
    <div className="group flex items-start gap-1.5">
      <div className="line-clamp-3 flex-1">
        {person.highlight && (
          <ReactMarkdown components={inlineComponents}>
            {toInlineMarkdown(person.highlight)}
          </ReactMarkdown>
        )}
      </div>
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
            className="max-h-[440px] w-[440px] max-w-[90vw] overflow-y-auto"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {person.name} · highlights
              </span>
              <a
                href={person.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                View profile <ExternalLink className="size-3" />
              </a>
            </div>
            {person.highlights.map((h, i) => (
              <div
                key={i}
                className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-xs prose-headings:font-semibold prose-p:my-1 prose-a:decoration-dotted prose-a:underline-offset-2 prose-hr:my-2 prose-li:my-0.5 prose-ul:my-1"
              >
                <ReactMarkdown components={linkComponent}>
                  {toStructuredMarkdown(h)}
                </ReactMarkdown>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
