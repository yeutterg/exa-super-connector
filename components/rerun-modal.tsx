"use client";

// The query-debugging toolkit: re-run the same query with different retrieval
// parameters. Every knob maps 1:1 to a documented /search parameter, so the
// workflow generalizes to any query — the teaching arc is "same query,
// different corpus/mode, different truth." The re-run appends a new turn to
// the session so the before/after comparison stays on screen.

import { useState } from "react";
import { useApp } from "@/lib/store";
import type { RerunOptions, SearchRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Freshness = "any" | "30d" | "6mo";

const TYPE_CHOICES: { value: RerunOptions["type"]; label: string; hint: string }[] = [
  { value: "fast", label: "Fast", hint: "single-pass, lowest latency" },
  { value: "auto", label: "Auto", hint: "Exa picks the mode (default)" },
  { value: "deep-lite", label: "Deep-lite", hint: "light multi-step" },
  { value: "deep", label: "Deep", hint: "agentic: decomposes + reasons" },
];

const CORPUS_CHOICES: { value: string; label: string; hint: string }[] = [
  { value: "people", label: "People profiles", hint: "LinkedIn-style profiles" },
  { value: "company", label: "Companies", hint: "company pages" },
  { value: "news", label: "News", hint: "articles — supports date filters" },
  { value: "web", label: "Entire web", hint: "no category — everything" },
];

function freshnessToDate(f: Freshness): string | undefined {
  if (f === "any") return undefined;
  const d = new Date();
  if (f === "30d") d.setDate(d.getDate() - 30);
  else d.setMonth(d.getMonth() - 6);
  return d.toISOString();
}

export function RerunModal({
  record,
  open,
  onOpenChange,
}: {
  record: SearchRecord;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { runQuery, searchLoading } = useApp();
  const [type, setType] = useState<RerunOptions["type"]>(
    (record.request.type as RerunOptions["type"]) ?? "auto",
  );
  const [corpus, setCorpus] = useState<string>(record.request.category ?? "web");
  const [freshness, setFreshness] = useState<Freshness>("any");
  const [numResults, setNumResults] = useState<number>(record.request.numResults ?? 5);
  const [extractEntities, setExtractEntities] = useState(false);

  const isDeep = type.startsWith("deep");
  const datesSupported = corpus === "news" || corpus === "web";

  const run = () => {
    const options: RerunOptions = {
      type,
      category: corpus === "web" ? null : (corpus as RerunOptions["category"]),
      startPublishedDate: datesSupported ? freshnessToDate(freshness) : undefined,
      numResults,
      extractEntities: extractEntities && isDeep,
    };
    onOpenChange(false);
    void runQuery(record.query, options);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Re-run with different retrieval</DialogTitle>
          <DialogDescription>
            Same query, different parameters — every option below is a
            documented Exa /search parameter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <fieldset>
            <Label className="text-xs font-semibold">Search type</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as RerunOptions["type"])}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              {TYPE_CHOICES.map((c) => (
                <label
                  key={c.value}
                  className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs has-data-checked:border-primary"
                >
                  <RadioGroupItem value={c.value} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{c.label}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {c.hint}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </fieldset>

          <fieldset>
            <Label className="text-xs font-semibold">Corpus</Label>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              Search can only match what lives in the corpus — if the
              constraint lives in job postings or news, profiles can&apos;t
              answer it.
            </p>
            <RadioGroup
              value={corpus}
              onValueChange={setCorpus}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              {CORPUS_CHOICES.map((c) => (
                <label
                  key={c.value}
                  className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs has-data-checked:border-primary"
                >
                  <RadioGroupItem value={c.value} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{c.label}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {c.hint}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <fieldset>
              <Label className="text-xs font-semibold">
                Freshness
                {!datesSupported && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    (not supported on this corpus)
                  </span>
                )}
              </Label>
              <RadioGroup
                value={freshness}
                onValueChange={(v) => setFreshness(v as Freshness)}
                className="mt-2 flex gap-3"
                disabled={!datesSupported}
              >
                {(["any", "30d", "6mo"] as const).map((f) => (
                  <label key={f} className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <RadioGroupItem value={f} disabled={!datesSupported} />
                    {f === "any" ? "Any time" : f === "30d" ? "30 days" : "6 months"}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>

            <fieldset>
              <Label className="text-xs font-semibold">Results</Label>
              <RadioGroup
                value={String(numResults)}
                onValueChange={(v) => setNumResults(Number(v))}
                className="mt-2 flex gap-3"
              >
                {[5, 10].map((n) => (
                  <label key={n} className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <RadioGroupItem value={String(n)} />
                    {n}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          </div>

          <label
            className={`flex items-start gap-2 rounded-md border p-2.5 text-xs ${
              isDeep ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
          >
            <Checkbox
              checked={extractEntities && isDeep}
              onCheckedChange={(v) => setExtractEntities(Boolean(v))}
              disabled={!isDeep}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Extract entities (outputSchema)</span>
              <span className="block text-[10px] leading-relaxed text-muted-foreground">
                Deep modes can synthesize a structured answer: companies/orgs
                the query surfaces, each with a citation. From there, one click
                finds the people at each — the join a single search can&apos;t
                express.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={run} disabled={searchLoading}>
            Re-run search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
