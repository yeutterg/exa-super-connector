"use client";

// Route-level error boundary — a render/runtime crash shows a calm recovery
// card instead of a white screen. All demo state lives in localStorage, so
// "Try again" (re-render) or a reload loses nothing.

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-sm font-semibold">Something went sideways</h2>
      <p className="max-w-md text-xs text-muted-foreground">
        {error.message || "Unexpected error."} Your sessions are safe — they
        live in this browser.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.location.assign("/")}
        >
          Reload app
        </Button>
      </div>
    </div>
  );
}
