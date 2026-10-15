"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@repo/utils";
import { DeleteThreadDialog } from "@/features/chatbot/threads/components/DeleteThreadDialog";
import { RenameThreadDialog } from "@/features/chatbot/threads/components/RenameThreadDialog";
import { ThreadContextMenu } from "@/features/chatbot/threads/components/ThreadContextMenu";
import type { Thread } from "@/features/chatbot/threads/types";
import {
  formatThreadActivityLabel,
  getThreadTitle,
} from "@/features/chatbot/threads/utils";

type ThreadListItemProps = {
  thread: Thread;
  isActive?: boolean;
  isLoading?: boolean;
  onSelect: (threadId: string) => void;
  onRename: (threadId: string, name: string) => Promise<void>;
  onDelete: (threadId: string) => Promise<void>;
};

export const ThreadListItem = ({
  thread,
  isActive = false,
  isLoading = false,
  onSelect,
  onRename,
  onDelete,
}: ThreadListItemProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const title = getThreadTitle(thread);
  const activityLabel = formatThreadActivityLabel(thread);

  const handleConfirmRename = async (name: string) => {
    setIsRenaming(true);

    try {
      await onRename(thread.id, name);
      setIsRenameOpen(false);
    } catch (error) {
      console.error("Failed to rename thread", error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);

    try {
      await onDelete(thread.id);
      setIsDeleteOpen(false);
    } catch (error) {
      console.error("Failed to archive thread", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex w-full items-center gap-1 rounded-xl px-2.5 py-2 text-left text-xs text-foreground transition",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/60",
        isLoading && isActive && "opacity-70",
      )}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsMenuOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(thread.id)}
        disabled={isLoading && isActive}
        className="min-w-0 flex-1 text-left cursor-pointer"
      >
        <span className="block truncate font-medium">{title}</span>
        <span className="mt-0.5 block text-[9px] text-muted-foreground">
          {activityLabel}
        </span>
      </button>

      <button
        type="button"
        aria-label={`Open options for ${title}`}
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((open) => !open)}
        className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100 data-[open=true]:opacity-100 cursor-pointer"
        data-open={isMenuOpen}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>

      {isMenuOpen ? (
        <ThreadContextMenu
          onRename={() => {
            setIsMenuOpen(false);
            setIsRenameOpen(true);
          }}
          onDelete={() => {
            setIsMenuOpen(false);
            setIsDeleteOpen(true);
          }}
        />
      ) : null}

      <RenameThreadDialog
        open={isRenameOpen}
        initialName={thread.title}
        isSubmitting={isRenaming}
        onCancel={() => setIsRenameOpen(false)}
        onConfirm={handleConfirmRename}
      />

      <DeleteThreadDialog
        open={isDeleteOpen}
        threadLabel={title}
        isDeleting={isDeleting}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
