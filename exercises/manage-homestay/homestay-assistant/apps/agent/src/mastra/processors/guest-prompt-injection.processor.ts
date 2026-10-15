import type { MastraDBMessage } from "@mastra/core/agent";
import {
  PromptInjectionDetector,
  type ProcessInputArgs,
  type Processor,
} from "@mastra/core/processors";

import {
  extractMessageText,
  findLatestUserMessage,
} from "@/mastra/utils/latest-user-message";
import { isFirstPartyActionPrompt } from "@/mastra/utils/first-party-prompt";

type PromptInjectionOptions = ConstructorParameters<
  typeof PromptInjectionDetector
>[0];

/**
 * Runs Mastra's LLM `PromptInjectionDetector` over genuine guest free-text
 * only. When the turn was started by a first-party UI-action prompt
 * (`isFirstPartyActionPrompt` — `[book-form]`, `[book-stay]`,
 * `[booking-cancel]`, … built by the web app itself), the detector is
 * skipped: those strings are assembled from a seeded room name plus UUIDs,
 * never typed by a guest, and their imperative shape trips the classifier —
 * `strategy: "block"` then hard-stops a core booking/edit action.
 *
 * Everything else is delegated to the wrapped detector unchanged, so real
 * guest input keeps the same injection / jailbreak / system-override
 * screening.
 */
export class GuestPromptInjectionProcessor implements Processor {
  readonly id = "guest-prompt-injection-detector";

  readonly name = "Guest Prompt Injection Detector";

  private readonly detector: PromptInjectionDetector;

  constructor(options: PromptInjectionOptions) {
    this.detector = new PromptInjectionDetector(options);
  }

  async processInput(args: ProcessInputArgs): Promise<MastraDBMessage[]> {
    const latestUserMessage = findLatestUserMessage(args.messages);

    if (
      latestUserMessage &&
      isFirstPartyActionPrompt(extractMessageText(latestUserMessage))
    ) {
      return args.messages;
    }

    return this.detector.processInput(args);
  }
}
