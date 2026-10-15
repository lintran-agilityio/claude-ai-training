import type { ClientIdentity } from "@repo/schemas";

/**
 * Optional `## GUEST` block prepended to the system prompt when the browser
 * forwarded a reconciled identity with a usable name or locale.
 *
 * Personalization only. The block spells out that the model must not infer
 * booking ownership from it — the eval harness never sets `forwardedProps`
 * (except the prompt-cache eval, which opts a case in via
 * `AgentTurnOptions.identity`), so this is a no-op elsewhere and cannot shift
 * deterministic runs. The locale is explicitly subordinate to LANGUAGE
 * SUPPORT (reply in the language of the guest's latest message), so a
 * `vi-VN` browser never flips an English chat.
 *
 * Appended OUTSIDE buildHomestayAssistantPrompt / withDateContext (never
 * prepended) so it never disturbs the golden playbook section order, and so
 * the only per-guest content in the system prompt sits after the
 * prompt-cache prefix — two guests otherwise never share a cached prefix.
 * See `constants/prompts/PROMPT_CACHING.md` for the full invariant.
 */
export const withGuestContext = (
  basePrompt: string,
  identity: ClientIdentity | undefined,
): string => {
  const name = identity?.fullName ?? undefined;
  const locale = identity?.locale ?? undefined;

  if (!name && !locale) {
    return basePrompt;
  }

  const lines = ["## GUEST"];
  if (name) lines.push(`Name: ${name}`);
  if (locale) lines.push(`Browser locale: ${locale}`);
  lines.push(
    "Use only to address the guest naturally. Do not assume which bookings or rooms are theirs from this — always resolve bookings through tools.",
  );
  if (locale) {
    lines.push(
      "The browser locale is not the reply language — keep following LANGUAGE SUPPORT (the guest's latest message decides).",
    );
  }

  return `${basePrompt}\n\n${lines.join("\n")}`;
};
