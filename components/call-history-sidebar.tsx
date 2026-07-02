"use client";

// Clicking the cost meter opens this — every API call this session (query,
// type, cost). Clicking an entry jumps straight to that call in the UI;
// nothing re-fetches since historical calls are always already completed.

import { useApp } from "@/lib/store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Pill } from "@/components/pill";
import { fmtUSD as fmt, relativeTime } from "@/lib/format";

const TYPE_LABELS = { search: "search", brief: "brief", verify: "verify" } as const;
const TYPE_TONES = { search: "blue", brief: "neutral", verify: "neutral" } as const;

export function CallHistorySidebar() {
  const { costEntries, costTotal, callCount, callHistoryOpen, setCallHistoryOpen, goToCall } =
    useApp();

  const sorted = [...costEntries].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <Sheet open={callHistoryOpen} onOpenChange={setCallHistoryOpen}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle>Call history</SheetTitle>
          <p className="text-xs text-muted-foreground">
            {callCount} {callCount === 1 ? "call" : "calls"} this session ·{" "}
            <span className="tabular-nums">{fmt(costTotal)}</span> total
          </p>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-4">
          {sorted.map((entry) => (
            <button
              key={entry.id}
              onClick={() => goToCall(entry)}
              className="rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
            >
              <div className="line-clamp-2 leading-snug">{entry.label}</div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Pill tone={TYPE_TONES[entry.type]}>{TYPE_LABELS[entry.type]}</Pill>
                <Pill tone="green">{fmt(entry.amount)}</Pill>
                <span className="text-[10px] text-muted-foreground">
                  {relativeTime(entry.timestamp)}
                </span>
              </div>
            </button>
          ))}
          {sorted.length === 0 && (
            <p className="px-1 py-4 text-center text-xs text-muted-foreground">
              No calls yet this session.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
