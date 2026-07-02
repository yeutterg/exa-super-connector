"use client";

// Shiki-highlighted code block (github-dark, per plan). Highlighting is async;
// we render dim plaintext until the highlighter resolves. Capped to ~15 lines
// with internal scroll so long JSON bodies don't dominate the thread; a copy
// button stays pinned top-right regardless of scroll position.
//
// Glossary tooltips: annotateGlossary marks known Exa keys with `data-tip`.
// Native `title` tooltips were too slow/unreliable (users just saw the
// question-mark cursor), so we delegate hover on the wrapper and render an
// instant, styled tooltip. `position: fixed` lets it escape the pre's
// overflow clipping.

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { BundledLanguage } from "shiki";
import { annotateGlossary } from "@/lib/glossary";

const htmlCache = new Map<string, string>();
// ~15 lines at text-xs/leading-relaxed + padding — override via maxHeightClassName.
const DEFAULT_MAX_HEIGHT = "max-h-[320px]";

interface Tip {
  text: string;
  x: number;
  y: number;
}

export function CodeBlock({
  code,
  lang,
  className = "",
  maxHeightClassName = DEFAULT_MAX_HEIGHT,
}: {
  code: string;
  lang: BundledLanguage;
  className?: string;
  maxHeightClassName?: string;
}) {
  const cacheKey = `${lang}:${code}`;
  const [rendered, setRendered] = useState<{ key: string; html: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (htmlCache.has(cacheKey)) return; // derived from cache at render time
    let cancelled = false;
    import("shiki").then(({ codeToHtml }) =>
      codeToHtml(code, { lang, theme: "github-dark" }).then((out) => {
        const annotated = lang === "json" ? annotateGlossary(out, code) : out;
        htmlCache.set(cacheKey, annotated);
        if (!cancelled) setRendered({ key: cacheKey, html: annotated });
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [cacheKey, code, lang]);

  const html =
    rendered?.key === cacheKey ? rendered.html : (htmlCache.get(cacheKey) ?? null);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Hover delegation for glossary terms — one listener on the wrapper
  // instead of wiring React tooltips into injected HTML.
  const handleOver = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest?.(
      "[data-tip]",
    ) as HTMLElement | null;
    if (el?.dataset.tip) {
      const r = el.getBoundingClientRect();
      setTip({ text: el.dataset.tip, x: r.left + r.width / 2, y: r.top });
    } else if (tip) {
      setTip(null);
    }
  };

  // Dismissal safety net: wrapper mouseleave alone proved unreliable (fast
  // pointer jumps can skip it), so while a tip is open, any pointer movement
  // or scroll outside a [data-tip] element clears it at the window level.
  useEffect(() => {
    if (!tip) return;
    const clear = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.("[data-tip]")) setTip(null);
    };
    window.addEventListener("mousemove", clear, { passive: true });
    window.addEventListener("scroll", clear, { passive: true, capture: true });
    return () => {
      window.removeEventListener("mousemove", clear);
      window.removeEventListener("scroll", clear, { capture: true });
    };
  }, [tip]);

  const copyButton = (
    <button
      type="button"
      onClick={copy}
      className={`absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-1 text-[10px] text-white/80 backdrop-blur-sm transition-opacity hover:bg-black/80 hover:text-white ${
        copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );

  const tooltip = tip && (
    <div
      className="pointer-events-none fixed z-50 max-w-xs rounded-md bg-foreground px-3 py-1.5 text-xs leading-relaxed text-background shadow-md"
      style={{
        left: tip.x,
        top: tip.y - 6,
        transform: "translate(-50%, -100%)",
      }}
    >
      {tip.text}
    </div>
  );

  if (!html) {
    return (
      <div className={`group relative ${className}`}>
        {copyButton}
        <pre
          className={`${maxHeightClassName} overflow-auto rounded-md bg-[#0d1117] p-4 text-xs leading-relaxed whitespace-pre-wrap break-words text-muted-foreground`}
        >
          <code>{code}</code>
        </pre>
      </div>
    );
  }
  return (
    <div
      className={`group relative ${className}`}
      onMouseOver={handleOver}
      onMouseLeave={() => setTip(null)}
    >
      {copyButton}
      {tooltip}
      <div
        className={`shiki-block ${maxHeightClassName} overflow-auto rounded-md text-xs leading-relaxed [&>pre]:m-0 [&>pre]:overflow-visible [&>pre]:p-4 [&>pre]:whitespace-pre-wrap [&>pre]:break-words`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
