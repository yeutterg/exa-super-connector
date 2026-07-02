"use client";

// ChatGPT-style session history. Each entry is a session that may hold
// multiple appended search turns. Clicking one reloads its cached state
// instantly — no network call, no cost tick. Hover reveals a delete button.

import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ExaLogoMark } from "@/components/exa-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { relativeTime } from "@/lib/format";

export function HistorySidebar() {
  const { searches, sessions, activeSessionId, selectSession, deleteSession, resetToHome } =
    useApp();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={resetToHome}
          className="flex items-center gap-2.5 rounded-md text-left transition-colors"
          title="New search"
        >
          <ExaLogoMark className="h-5 w-5 shrink-0" />
          <span
            className="text-sm font-semibold tracking-tight"
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          >
            Super Connector
          </span>
        </button>
        <ThemeToggle />
      </div>
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Searches
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={resetToHome}
          title="New search"
          className="size-5"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-2 pb-4">
          {[...sessions]
            .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
            .map((session) => {
              const firstRecord = searches.find((s) => s.id === session.recordIds[0]);
              return (
                <div key={session.id} className="group relative">
                  <button
                    onClick={() => selectSession(session.id)}
                    className={`w-full rounded-md px-2 py-2 pr-7 text-left text-xs transition-colors hover:bg-accent ${
                      session.id === activeSessionId ? "bg-accent" : ""
                    }`}
                  >
                    <div className="leading-snug break-words">
                      {firstRecord?.query ?? "…"}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {relativeTime(session.lastActiveAt)}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    title="Delete"
                    className="absolute top-1.5 right-1.5 rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3 text-muted-foreground" />
                  </button>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </aside>
  );
}
