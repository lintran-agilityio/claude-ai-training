import type { ReactNode } from "react";

import { cn } from "@repo/utils";

type EmbeddedWidgetProps = {
  children: ReactNode;
  className?: string;
  /**
   * When true, only applies chat scale + width — child supplies its own frame.
   * Default wraps content in a bordered card distinct from message bubbles.
   */
  unframed?: boolean;
};

/**
 * Timeline block for tool / generative UI (Booking Form, Room Detail,
 * Booking Summary, Confirmation Card, …).
 *
 * Not a chat message: no avatar, no bubble — an independent content block.
 */
export const EmbeddedWidget = ({
  children,
  className,
  unframed = false,
}: EmbeddedWidgetProps) => (
  <div
    data-chat-embedded-widget
    data-chat-tool-ui
    className="w-full px-3"
  >
    <div
      className={cn(
        "chat-tool-card w-full max-w-[min(100%,340px)] origin-top-left [zoom:0.92]",
        !unframed &&
          "overflow-hidden rounded-2xl border border-border bg-card text-sm leading-snug text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  </div>
);
