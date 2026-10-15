"use client";

import { Plus } from "lucide-react";

type NewThreadButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export const NewThreadButton = ({
  onClick,
  disabled = false,
}: NewThreadButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border border-primary text-primary bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
    >
      <Plus className="size-4 text-primary" aria-hidden />
      New Thread
    </button>
  );
};
