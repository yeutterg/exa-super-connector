"use client";

import { AppProvider } from "@/lib/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HistorySidebar } from "@/components/history-sidebar";
import { SearchPanel } from "@/components/search-panel";
import { CallHistorySidebar } from "@/components/call-history-sidebar";

export function AppShell() {
  return (
    <AppProvider>
      <TooltipProvider delay={100}>
        <div className="relative flex h-screen overflow-hidden">
          <HistorySidebar />
          <SearchPanel />
          <CallHistorySidebar />
        </div>
      </TooltipProvider>
    </AppProvider>
  );
}
