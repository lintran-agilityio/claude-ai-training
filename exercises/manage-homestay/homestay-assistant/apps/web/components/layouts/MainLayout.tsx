"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { cn } from "@repo/utils";
import { AGENT_KEYS } from "@repo/constants";

import { Navbar } from "@/components/layouts";
import { NavbarTab } from "@repo/types";
import { ROUTES } from "@/constants";
import { ChatToggleButton } from "@/features/chatbot/components";
import { useChatIconStatus } from "@/features/chatbot/hooks";
import {
  useActiveThread,
  useArchiveThread,
  useCreateThread,
  useSwitchThread,
  useThreads,
  useThreadStore,
} from "@/features/chatbot/threads";

const ChatSidebar = dynamic(
  () =>
    import("@/features/chatbot/components/ChatSidebar").then(
      (mod) => mod.ChatSidebar,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full rounded-xl border border-border bg-muted/40" />
    ),
  },
);

const ThreadSidebar = dynamic(
  () =>
    import("@/features/chatbot/threads/components/ThreadSidebar").then(
      (mod) => mod.ThreadSidebar,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-56 border-r border-border px-3 py-3 text-xs text-muted-foreground">
        Loading threads...
      </div>
    ),
  },
);

type MainLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

export const MainLayout = ({ children, className }: MainLayoutProps) => {
  const pathname = usePathname();
  const activeTab =
    pathname === ROUTES.BOOKINGS ? NavbarTab.MY_BOOKINGS : NavbarTab.HOME;
  const [isChatOpen, setIsChatOpen] = useState(false);
  const agentId = AGENT_KEYS.HOMESTAY_ASSISTANT;
  const { scopeKey, activeThreadId, setActiveThread } = useActiveThread({
    agentId,
  });
  const { agent } = useAgent({ agentId });
  const loadingState = useThreadStore((state) => state.loadingState);
  const isDraftThread = useThreadStore((state) => state.isDraftThread);
  const {
    threads,
    threadGroups,
    isLoading: isLoadingThreads,
    threadsFetched,
    error: threadsError,
    refetchThreads,
    startNewThread,
    renameThread,
    archiveThread: archiveThreadRemote,
  } = useThreads({
    agentId,
    enabled: Boolean(scopeKey),
    activeThreadId,
  });

  const { createThread } = useCreateThread({
    agentId,
    startNewThread,
  });
  const { switchThread } = useSwitchThread({ agentId });

  const handleCreateThread = useCallback(() => {
    createThread();
  }, [createThread]);

  const { archiveThread } = useArchiveThread({
    agentId,
    threads,
    archiveThreadRemote,
    onCreateThread: handleCreateThread,
  });

  // Bootstrap: activate latest persisted thread, or create a draft.
  // Wait for threadsFetched — isLoading starts false before Intelligence
  // connects, so using only !isLoadingThreads races and mints an empty draft.
  useEffect(() => {
    if (!scopeKey || activeThreadId || !threadsFetched) {
      return;
    }

    const latestThread = threads[0];

    if (latestThread) {
      agent.setMessages?.([]);
      agent.threadId = latestThread.id;
      setActiveThread(latestThread.id);
      return;
    }

    handleCreateThread();
  }, [
    activeThreadId,
    agent,
    handleCreateThread,
    scopeKey,
    setActiveThread,
    threads,
    threadsFetched,
  ]);

  // Keep AG-UI agent.threadId === activeThreadId at all times.
  useEffect(() => {
    if (activeThreadId) {
      agent.threadId = activeThreadId;
    }
  }, [activeThreadId, agent]);

  // First run on a draft: refresh once so Intelligence replaces the local row.
  // Do not refetch on every subsequent message — that reloads the whole list.
  useEffect(() => {
    if (!scopeKey || !activeThreadId || agent.messages.length === 0) {
      return;
    }

    if (!isDraftThread(activeThreadId)) {
      return;
    }

    const refreshTimeout = window.setTimeout(() => {
      void refetchThreads();
    }, 500);

    return () => window.clearTimeout(refreshTimeout);
  }, [
    activeThreadId,
    agent.messages.length,
    isDraftThread,
    refetchThreads,
    scopeKey,
  ]);

  const handleRenameThread = useCallback(
    async (threadId: string, name: string) => {
      await renameThread(threadId, name);
    },
    [renameThread],
  );

  const chatIconStatus = useChatIconStatus({
    agentId,
    isChatOpen,
    threadId: activeThreadId,
  });

  return (
    <div className="mx-2 flex h-screen w-full justify-center bg-background">
      <div
        className={cn(
          "flex h-full w-full max-w-[1560px] flex-col overflow-hidden bg-background font-sans",
          className,
        )}
      >
        <Navbar activeTab={activeTab} />
        <div className="relative flex min-h-0 min-w-0 flex-1">
          <div className="hidden h-full min-h-0 shrink-0 lg:block">
            <ThreadSidebar
              threads={threads}
              threadGroups={threadGroups}
              activeThreadId={activeThreadId}
              isLoading={isLoadingThreads}
              isSwitching={loadingState === "loading"}
              error={threadsError}
              onSelectThread={switchThread}
              onCreateThread={handleCreateThread}
              onRenameThread={handleRenameThread}
              onDeleteThread={archiveThread}
            />
          </div>
          <main className="app-scrollbar relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-8 md:px-4">
            {children}
          </main>
          {/* Closed: circular FAB over the room list (bottom-right, all breakpoints). */}
          {!isChatOpen ? (
            <ChatToggleButton
              isChatOpen={false}
              status={chatIconStatus}
              onToggle={() => setIsChatOpen(true)}
            />
          ) : null}
          <div
            className={cn(
              "relative z-10 min-h-0 shrink-0 overflow-visible bg-background transition-[width] duration-300 ease-in-out",
              isChatOpen
                ? "fixed inset-0 z-40 h-full w-full p-4 lg:static lg:z-10 lg:h-full lg:w-[min(100%,552px)] lg:p-4"
                : "hidden w-0 border-l-0 lg:block",
            )}
          >
            <div
              className={cn(
                "relative h-full overflow-hidden transition-opacity duration-200",
                isChatOpen
                  ? "w-full opacity-100"
                  : "pointer-events-none w-0 opacity-0",
              )}
            >
              <ChatSidebar className="h-full w-full" agentId={agentId} />
              {isChatOpen ? (
                <ChatToggleButton
                  isChatOpen
                  status={chatIconStatus}
                  onToggle={() => setIsChatOpen(false)}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
