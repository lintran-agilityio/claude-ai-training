import { PREFIX_URL } from "@repo/types";

/**
 * Fallback API base URL when `API_URL` is unset — only hit locally or as a
 * defensive default (every real deployment sets `API_URL`).
 * - dev: the Nest API listens on 5001 (`apps/api/.env` PORT=5001)
 * - prod: the Nest API listens on 10000 (`apps/api/src/main.ts`, render.yaml PORT)
 */
const DEFAULT_API_URL =
  process.env.NODE_ENV === "production"
    ? "http://localhost:10000"
    : "http://localhost:5001";

/**
 * Base URL for the NestJS API. Trailing slashes are stripped so callers can
 * safely concatenate a leading-slash path (`${getApiUrl()}${ROUTES.ROOMS}`)
 * without producing `//rooms`, which Nest 404s. This matters in production
 * where `API_URL` is often pasted from a dashboard with a trailing `/`.
 */
export const getApiUrl = () =>
  (process.env.API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "");
export const WEB_API_BASE = "/api" as const;
export const getBaseUrl = (via: PREFIX_URL) => via === PREFIX_URL.BACKEND ? getApiUrl() : WEB_API_BASE;
