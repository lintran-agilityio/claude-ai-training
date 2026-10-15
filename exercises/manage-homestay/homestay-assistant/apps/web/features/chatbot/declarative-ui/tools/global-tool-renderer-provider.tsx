"use client";

import { useDefaultRenderTool } from "@copilotkit/react-core/v2";

import { UnknownToolRenderer } from "@/features/chatbot/declarative-ui/components";

/**
 * Wildcard fallback for backend tools without a dedicated `useRenderTool`.
 * Mount after RoomToolsProvider / BookingToolsProvider so named renderers
 * register first; CopilotKit resolves exact names before `"*"`.
 */
export const GlobalToolRendererProvider = () => {
  useDefaultRenderTool({
    render: ({ name, status, result }) => (
      <UnknownToolRenderer name={name} status={status} result={result} />
    ),
  });

  return null;
};
