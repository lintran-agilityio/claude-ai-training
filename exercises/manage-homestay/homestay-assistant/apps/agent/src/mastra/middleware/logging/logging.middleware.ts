import type { MastraMiddlewareHandler } from "../server-middleware.types";
import {
  buildRequestLogContext,
  getMastraLogger,
  logRequestComplete,
  logRequestStart,
} from "./logger";
import type { LoggingConfig } from "./logging.types";

const DEFAULT_EXCLUDE_PATHS = ["/health", "/ready"];

const shouldSkipLogging = (path: string, excludePaths: string[]): boolean =>
  excludePaths.some(
    (excludedPath) =>
      path === excludedPath || path.startsWith(`${excludedPath}/`),
  );

export const createLoggingMiddleware = (
  config: LoggingConfig = {},
): MastraMiddlewareHandler => {
  const excludePaths = config.excludePaths ?? DEFAULT_EXCLUDE_PATHS;

  return async (context, next) => {
    if (shouldSkipLogging(context.req.path, excludePaths)) {
      await next();
      return;
    }

    const logger = getMastraLogger(context);
    const requestLogContext = buildRequestLogContext(context);
    const startedAt = Date.now();

    logRequestStart(logger, requestLogContext);

    await next();

    logRequestComplete(logger, {
      ...requestLogContext,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    });
  };
};

export const loggingMiddleware = createLoggingMiddleware();
