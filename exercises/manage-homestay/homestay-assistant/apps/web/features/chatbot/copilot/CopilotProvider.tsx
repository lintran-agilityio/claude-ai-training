"use client";

import { CopilotContexts } from "@/features/chatbot/copilot/contexts";
import { AgentMessagesSanitizer } from "@/features/chatbot/copilot/AgentMessagesSanitizer";
import { DeclarativeUiToolProviders } from "@/features/chatbot/declarative-ui/tools";

type CopilotProviderProps = {
  children: React.ReactNode;
};

/**
 * Client-side CopilotKit runtime wiring, mounted inside <CopilotKitProvider>:
 * agent-context readables, the transcript-sanitizer compat shim, and every
 * generative-UI tool renderer (see features/chatbot/declarative-ui).
 */
export const CopilotProvider = ({ children }: CopilotProviderProps) => {
  return (
    <>
      <CopilotContexts />
      <AgentMessagesSanitizer />
      <DeclarativeUiToolProviders />
      {children}
    </>
  );
};
