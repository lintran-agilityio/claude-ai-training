"use client";

import { Pencil, Archive } from "lucide-react";

type ThreadContextMenuProps = {
  onRename: () => void;
  onDelete: () => void;
};

export const ThreadContextMenu = ({
  onRename,
  onDelete,
}: ThreadContextMenuProps) => {
  return (
    <div className="absolute right-1 top-9 z-20 w-32 rounded-xl border border-border bg-popover p-1 shadow-xl">
      <button
        type="button"
        onClick={onRename}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-popover-foreground transition hover:bg-accent"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Rename
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-destructive transition hover:bg-destructive/10"
      >
        <Archive className="h-3.5 w-3.5" aria-hidden />
        Archive
      </button>
    </div>
  );
};
