import type { ReactNode } from "react";

const TONE_CLASSES: Record<string, string> = {
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  green:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  neutral: "border-transparent bg-muted text-muted-foreground",
};

/** Color-coded pill — used for method/category tags and result stats. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "neutral";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
