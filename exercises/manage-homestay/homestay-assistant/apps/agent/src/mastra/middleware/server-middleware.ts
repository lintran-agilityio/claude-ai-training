import type { Middleware } from "@mastra/core/server";

import { authenticationMiddleware } from "./authentication/authentication.middleware";
import { errorMiddleware } from "./error/error.middleware";
import { loggingMiddleware } from "./logging/logging.middleware";

// loggingMiddleware must wrap authenticationMiddleware: auth returns 401
// before calling next(), so logging has to run first in the chain or
// unauthenticated requests never get an audit trail entry.
export const middlewares: Middleware[] = [
  loggingMiddleware,
  authenticationMiddleware,
];

export const createMastraServerMiddleware = (): Middleware[] => [
  errorMiddleware,
  ...middlewares,
];
