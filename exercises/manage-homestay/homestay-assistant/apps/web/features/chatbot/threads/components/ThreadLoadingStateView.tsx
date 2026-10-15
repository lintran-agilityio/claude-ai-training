"use client";

type ThreadLoadingStateViewProps = {
  errorMessage?: string | null;
  onRetry?: () => void;
};

export const ThreadLoadingStateView = ({
  errorMessage,
  onRetry,
}: ThreadLoadingStateViewProps) => {
  if (errorMessage) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-foreground">Couldn&apos;t load conversation</p>
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition hover:bg-accent cursor-pointer"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm text-foreground">Loading conversation</p>
      <p className="text-xs text-muted-foreground">…</p>
    </div>
  );
};
