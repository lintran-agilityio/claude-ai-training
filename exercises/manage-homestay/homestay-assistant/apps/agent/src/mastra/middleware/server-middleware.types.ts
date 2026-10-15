import type { ContextWithMastra, Middleware } from "@mastra/core/server";

export type { ContextWithMastra, Middleware };

export type MiddlewareNext = () => Promise<void>;

export type MastraMiddlewareHandler = (
  context: ContextWithMastra,
  next: MiddlewareNext,
) => Promise<Response | void>;
