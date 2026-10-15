import { getBusinessDates } from "@repo/utils/date";

/** Prompt block with today + tomorrow so relative dates resolve correctly. */
export const buildDateContextPrompt = (now = new Date()): string => {
  const dates = getBusinessDates(now);

  return `## DATE CONTEXT
    Today: ${dates.todayWeekday}, ${dates.today} (${dates.timezone})
    Tomorrow: ${dates.tomorrow}
    This weekend: ${dates.weekendCheckIn} → ${dates.weekendCheckOut}
    Next weekend: ${dates.nextWeekendCheckIn} → ${dates.nextWeekendCheckOut}

    ## DATE RESOLUTION
    - Resolve relative dates to YYYY-MM-DD.
    - Use the precomputed weekend dates above.
    - Pass only YYYY-MM-DD to date fields/tools.
    - Latest user-provided date overrides earlier date state.
    - Current date is context only; it is not an implicit booking date.
  `;
};

/**
 * Append DATE CONTEXT after the static prompt (not prepend) so the request's
 * only per-day content sits after the prompt-cache prefix — see
 * `withGuestContext` for the per-guest counterpart and why both live at the
 * tail. It's still a short, clearly-labeled block right before the guest's
 * own turn, not buried under the long static sections ahead of it. See
 * `constants/prompts/PROMPT_CACHING.md` for the full invariant.
 */
export const withDateContext = (basePrompt: string): string =>
  `${basePrompt}

${buildDateContextPrompt()}`;
