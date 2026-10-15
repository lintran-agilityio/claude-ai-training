"use client";

import type { ReactNode } from "react";

export type ConfirmHitlHeaderTone = "emerald" | "destructive" | "neutral";

export type ConfirmHitlHeaderProps = {
  title: string;
  description: ReactNode;
  icon: ReactNode;
  tone: ConfirmHitlHeaderTone;
  trailing?: ReactNode;
};

const TONE_CLASS: Record<ConfirmHitlHeaderTone, string> = {
  emerald:
    "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
  destructive:
    "flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive",
  neutral:
    "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
};

/**
 * Presentational HITL card header: icon, title, description, optional trailing.
 */
export const ConfirmHitlHeader = ({
  title,
  description,
  icon,
  tone,
  trailing,
}: ConfirmHitlHeaderProps) => (
  <div className="flex items-start gap-2.5">
    <div className={TONE_CLASS[tone]}>{icon}</div>
    <div className="min-w-0 flex-1 space-y-1">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    {trailing}
  </div>
);
