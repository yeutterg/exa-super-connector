"use client";

// Small hover-revealed copy button — appears when the enclosing `group`
// element is hovered. Used next to names, emails, and links.

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyInline({ value }: { value: string }) {
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
