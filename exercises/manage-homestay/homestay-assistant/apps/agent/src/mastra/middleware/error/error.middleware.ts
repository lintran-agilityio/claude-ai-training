import type { MastraMiddlewareHandler } from "../server-middleware.types";
import { getMastraLogger } from "../logging/logger";
import { mapErrorToResponse } from "./error.mapper";

export const errorMiddleware: MastraMiddlewareHandler = async (
  context,
  next,
) => {
  try {
    await next();
  } catch (error) {
    const mappedError = mapErrorToResponse({ error });

    getMastraLogger(context).error("HTTP request failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return context.json(mappedError.body, mappedError.status);
  }
};
