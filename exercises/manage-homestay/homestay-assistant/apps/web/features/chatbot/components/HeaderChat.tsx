// Libs
import { RotateCcw } from "lucide-react";

// Internal
import { cn } from "@repo/utils";
import { LogoMark } from "@/components/common";

type HeaderChatProps = {
  title?: string;
  subtitle?: string;
  online?: boolean;
  className?: string;
  onReset?: () => void;
};

/**
 * Chat sidebar header with online status and optional conversation reset.
 *
 * @param props - Title, subtitle, online indicator, and reset handler
 */
export const HeaderChat = ({
  title = "AI Concierge",
  subtitle = "Boutique homestay bookings",
  online = true,
  className,
  onReset,
}: HeaderChatProps) => {
  return (
    <div
      className={cn(
        "flex items-start justify-between rounded-t-2xl border-b border-border px-5 py-4 pr-12",
        className,
      )}
    >
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
          <LogoMark className="size-4" />
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 pt-1 pr-4">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset conversation"
            title="Start over"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-gold/40 hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3" aria-hidden />
            Reset
          </button>
        ) : null}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              online ? "bg-emerald-500" : "bg-muted-foreground",
            )}
          />
          <span className="text-[11px] font-medium text-muted-foreground">
            {online ? "Online" : "Offline"}
          </span>
        </div>
      </div>
    </div>
  );
};
