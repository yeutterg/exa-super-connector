"use client";

// Build Brief enrichment card — the payoff feature. Verified email + cited
// why-now signals. Attribution is honest about what Exa actually returns:
// there's no per-signal "which provider" field, so routing is shown once at
// the card level (from costDollars.dataSources), not faked per bullet.
// Copy Opener is a template string (no LLM).

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { BriefRecord, Person } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/pill";
import { PROVIDER_LABELS } from "@/lib/exa";
import { fmtUSD } from "@/lib/format";

/** Small hover-revealed copy button — for the name and email in the card header. */
function CopyInline({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy"
      className="ml-1 inline-flex opacity-0 transition-opacity group-hover:opacity-100"
    >
      {copied ? (
        <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-3 text-muted-foreground hover:text-foreground" />
      )}
    </button>
  );
}

function buildOpener(person: Person, brief: BriefRecord): string {
  const first = person.name.split(" ")[0];
  const top = brief.output.whyNow[0];
  if (!top) return `Hi ${first} — quick question about ${person.company}.`;
  const signal = top.signal.replace(/\.$/, "");
  return (
    `Hi ${first} — saw that ${signal}. ` +
    `Teams at that stage usually hit a wall running revenue ops manually — ` +
    `worth a 15-minute look at how we fix that?`
  );
}

export function BriefCard({
  person,
  brief,
  onClose,
}: {
  person: Person;
  brief: BriefRecord;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const opener = buildOpener(person, brief);

  const copy = async () => {
    await navigator.clipboard.writeText(opener);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="group flex items-center text-sm">
            Brief · {person.name}
            <CopyInline value={person.name} />
            <span className="font-normal text-muted-foreground">
              &nbsp;— {person.title}, {person.company}
            </span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="group flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {brief.output.email ? "Verified email" : "Email"}
          </span>
          <code className="rounded bg-muted px-1.5 py-0.5">
            {brief.output.email ?? "not found"}
          </code>
          {brief.output.email && <CopyInline value={brief.output.email} />}
          {brief.routedTo.includes("fiber_ai") && (
            <Pill tone="neutral">via Fiber.ai</Pill>
          )}
          <Pill tone="neutral">{(brief.durationMs / 1000).toFixed(1)}s</Pill>
          <Pill tone="green">{fmtUSD(brief.cost.total)}</Pill>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Why reach out now
          </div>
          <ul className="space-y-2">
            {brief.output.whyNow.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  {s.signal}{" "}
                  <a
                    href={s.source}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground underline decoration-dotted underline-offset-2"
                  >
                    {new URL(s.source).hostname}
                  </a>{" "}
                  <span className="text-muted-foreground">· {s.date}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
          {opener}
        </div>
        <div className="flex items-center justify-between">
          <Button size="sm" onClick={copy}>
            {copied ? "Copied" : "Copy Opener"}
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {brief.routedTo.length > 0 ? (
              <>
                Routed to: Exa web research +{" "}
                {brief.routedTo.map((r) => PROVIDER_LABELS[r] ?? r).join(" + ")}
                {!brief.routedTo.includes("financial_datasets") &&
                  " — Financial Datasets not called (private company or no ticker news)"}
              </>
            ) : (
              "Routed to: Exa web research only — no Connect partner data source was needed"
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
