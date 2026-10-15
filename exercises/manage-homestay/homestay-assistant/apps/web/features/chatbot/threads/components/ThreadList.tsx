"use client";

import type { Thread, ThreadDateGroup } from "@/features/chatbot/threads/types";
import { ThreadListItem } from "@/features/chatbot/threads/components/ThreadListItem";

type ThreadGroupProps = {
  group: ThreadDateGroup;
  activeThreadId?: string | null;
  isSwitching?: boolean;
  onSelect: (threadId: string) => void;
  onRename: (threadId: string, name: string) => Promise<void>;
  onDelete: (threadId: string) => Promise<void>;
};

const ThreadGroup = ({
  group,
  activeThreadId,
  isSwitching = false,
  onSelect,
  onRename,
  onDelete,
}: ThreadGroupProps) => {
  return (
    <div className="space-y-1">
      <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {group.label}
      </p>
      {group.threads.map((thread) => (
        <ThreadListItem
          key={thread.id}
          thread={thread}
          isActive={activeThreadId === thread.id}
          isLoading={isSwitching && activeThreadId === thread.id}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

type ThreadListProps = {
  groups: ThreadDateGroup[];
  threads: Thread[];
  activeThreadId?: string | null;
  isLoading?: boolean;
  isSwitching?: boolean;
  error?: Error | null;
  onSelect: (threadId: string) => void;
  onRename: (threadId: string, name: string) => Promise<void>;
  onDelete: (threadId: string) => Promise<void>;
};

export const ThreadList = ({
  groups,
  threads,
  activeThreadId,
  isLoading = false,
  isSwitching = false,
  error = null,
  onSelect,
  onRename,
  onDelete,
}: ThreadListProps) => {
  // Only block the list on the initial fetch — keep existing rows visible
  // while a background refetch runs (e.g. draft → persisted).
  if (isLoading && threads.length === 0) {
    return (
      <div className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
        Loading threads...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        Failed to load threads.
        {error.message ? (
          <p className="mt-1 text-[11px] text-destructive/80">{error.message}</p>
        ) : null}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
        No saved threads yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <ThreadGroup
          key={group.key}
          group={group}
          activeThreadId={activeThreadId}
          isSwitching={isSwitching}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
