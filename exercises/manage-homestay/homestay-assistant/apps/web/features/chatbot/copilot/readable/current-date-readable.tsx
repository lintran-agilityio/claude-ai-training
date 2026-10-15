"use client";

import { useMemo } from "react";
import { useAgentContext } from "@copilotkit/react-core/v2";
import { getBusinessDates } from "@repo/utils/date";

/**
 * Always injects today's calendar date into agent context so relative
 * phrases like "tomorrow" resolve correctly (models have no wall clock).
 * The weekend stay is precomputed because models cannot derive a weekday.
 */
export const CurrentDateReadable = () => {
  const value = useMemo(() => getBusinessDates(), []);

  useAgentContext({
    description:
      "Authoritative business calendar. Resolve relative dates using today and tomorrow. For \"this weekend\" use weekendCheckIn / weekendCheckOut verbatim; for \"next weekend\" use nextWeekendCheckIn / nextWeekendCheckOut verbatim — never compute weekend dates and never mix up the two pairs.",
    value,
  });

  return null;
};
