import type { ContextWithMastra } from "@mastra/core/server";

import type { RequestLogContext, ResponseLogContext } from "./logging.types";

export type MiddlewareLogger = {
  info: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
};

export const getMastraLogger = (context: ContextWithMastra): MiddlewareLogger =>
  context.get("mastra").getLogger() as MiddlewareLogger;

export const buildRequestLogContext = (
  context: ContextWithMastra,
): RequestLogContext => ({
  method: context.req.method,
  path: context.req.path,
});

export const logRequestStart = (
  logger: MiddlewareLogger,
  logContext: RequestLogContext,
): void => {
  logger.info("HTTP request started", logContext);
};

export const logRequestComplete = (
  logger: MiddlewareLogger,
  logContext: ResponseLogContext,
): void => {
  logger.info("HTTP request completed", logContext);
};
