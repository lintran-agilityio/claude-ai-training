"use client";

import { CHAT_VISIBLE_GENERATIVE_TOOLS } from "@/features/chatbot/declarative-ui/config/page-generative-ui";

type UnknownToolRendererProps = {
  name: string;
  status: "inProgress" | "executing" | "complete";
  result: string | undefined;
};

export const UnknownToolRenderer = ({
  name,
  status,
  result,
}: UnknownToolRendererProps) => {
  if (CHAT_VISIBLE_GENERATIVE_TOOLS.has(name)) {
    return null;
  }

  if (status === "inProgress") {
    return (
      <div
        role="status"
        aria-label="Processing"
        className="flex items-center gap-1.5 py-1"
      >
        <span className="sr-only">Processing</span>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden
            className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: `${index * 150}ms` }}
          />
        ))}
      </div>
    );
  }

  if (status !== "complete") {
    return null;
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[Unknown CopilotKit tool renderer]", { name, result });
  }

  return null;
};
