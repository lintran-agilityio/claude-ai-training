import type { ErrorMapperInput, MappedErrorResponse } from "./error.types";
import { AUTH_ERROR_MESSAGES } from "../constants";

const DEFAULT_ERROR_MESSAGE = "Internal server error";

export const mapErrorToResponse = ({
  error,
}: ErrorMapperInput): MappedErrorResponse => {
  if (error instanceof Error) {
    const status: MappedErrorResponse["status"] = AUTH_ERROR_MESSAGES.has(
      error.message,
    )
      ? 401
      : 500;

    return {
      status,
      body: {
        error: status === 500 ? DEFAULT_ERROR_MESSAGE : error.message,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: DEFAULT_ERROR_MESSAGE,
    },
  };
};
