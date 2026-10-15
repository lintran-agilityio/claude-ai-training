"use client";

// Libs
import { forwardRef } from "react";
import {
  CopilotChatSuggestionPill,
  type CopilotChatSuggestionPillProps
} from "@copilotkit/react-core/v2";

import { cn } from "@repo/utils";

export const CopilotSuggestion = forwardRef<
HTMLButtonElement,
CopilotChatSuggestionPillProps
>(function StyledSuggestionPill({ className, ...props }, ref) {
return (
  <CopilotChatSuggestionPill
    {...props}
    ref={ref}
    className={cn(
      "rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-foreground",
      className,
    )}
  />
);
});
