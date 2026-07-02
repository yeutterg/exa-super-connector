"use client";

// Live session cost meter — must-have #1. Reads real per-call costs from the
// store (search costDollars.total; brief attributed breakdown). Hover shows
// the last action's per-source split.

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtUSD as fmt } from "@/lib/format";

export function CostMeter() {
  const { callCount, costTotal, costEntries, setCallHistoryOpen } = useApp();
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(callCount);

  useEffect(() => {
    if (callCount > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 700);
      prevCount.current = callCount;
      return () => clearTimeout(t);
    }
    prevCount.current = callCount;
  }, [callCount]);

  const last = costEntries[costEntries.length - 1];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => setCallHistoryOpen(true)}
            className={`flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs tabular-nums transition-all duration-300 ${
              pulse ? "scale-110 border-primary text-primary" : "text-foreground"
            }`}
          />
        }
      >
        <span className="font-semibold">Exa</span>
        <span className="text-muted-foreground">
          {callCount} {callCount === 1 ? "call" : "calls"}
        </span>
        <span className="font-medium">{fmt(costTotal)}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-xs">
        {last ? (
          <div className="space-y-1 text-xs">
            <div className="font-medium">Last: {last.label}</div>
            <div className="tabular-nums">
              {(last.breakdown ?? [{ label: "search", amount: last.amount }])
                .map((b) => `${b.label} ${fmt(b.amount)}`)
                .join(" · ")}
            </div>
            <div className="text-muted-foreground">
              Exact figures from costDollars — not estimates.
            </div>
          </div>
        ) : (
          <span className="text-xs">No API calls yet this session.</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
