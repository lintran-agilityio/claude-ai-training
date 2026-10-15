"use client";

type ChatRunErrorNoticeProps = {
  message: string;
  isRetrying?: boolean;
  onRetry?: () => void;
  onDismiss: () => void;
};

/**
 * Inline banner for a chat action that could not start. Retry is optional —
 * run-start failures re-run the agent; busy-agent blocks only dismiss.
 */
export const ChatRunErrorNotice = ({
  message,
  isRetrying = false,
  onRetry,
  onDismiss,
}: ChatRunErrorNoticeProps) => {
  return (
    <div
      role="alert"
      className="mx-4 mb-3 flex items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2"
    >
      <p className="min-w-0 flex-1 text-xs text-amber-700 dark:text-amber-200">
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isRetrying ? "Retrying…" : "Retry"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded-md px-1.5 py-1 text-xs text-muted-foreground transition hover:text-foreground cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
};
