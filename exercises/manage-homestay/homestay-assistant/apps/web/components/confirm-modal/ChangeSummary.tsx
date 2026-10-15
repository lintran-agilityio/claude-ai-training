"use client";

import type { ModifyChangeRow } from "@/features/booking/utils";

export type ChangeSummaryProps = {
  changes: ModifyChangeRow[];
};

/**
 * Modify-only before → after summary. Do not reuse for create/cancel.
 * Callers should not pass an empty list for the review phase (no-op modifies
 * are dismissed before this renders).
 */
export const ChangeSummary = ({ changes }: ChangeSummaryProps) => {
  if (changes.length === 0) {
    return null;
  }

  const showChangesHeading = changes.length > 1;

  return (
    <dl className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-xs">
      {showChangesHeading ? (
        <div className="pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Changes
        </div>
      ) : null}

      {changes.map((row, index) => (
        <div
          key={row.label}
          className={
            row.label === "Total"
              ? `flex justify-between gap-4 ${index > 0 ? "border-t border-border pt-1.5" : ""}`
              : "flex justify-between gap-4"
          }
        >
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd
            className={
              row.label === "Total"
                ? "text-right font-medium text-primary"
                : "text-right text-foreground"
            }
          >
            <span className="text-muted-foreground">{row.from}</span>
            <span className="mx-1.5 text-muted-foreground">→</span>
            <span>{row.to}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
};
