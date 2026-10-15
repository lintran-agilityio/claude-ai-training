import type { ProcessInputStepArgs, Processor } from "@mastra/core/processors";

import {
  resolveCompareCandidates,
  stashCompareCandidates,
} from "@/mastra/utils/compare-rooms";

/**
 * Runs before every step so compare_rooms can read the rooms the guest is
 * looking at — the latest search/recommend find_room in this conversation —
 * without the model passing any room data. Re-pinned every step because the
 * request context is rebuilt per HTTP request (a HITL resume starts fresh).
 */
export class CompareRoomsCandidatesProcessor implements Processor {
  id = "compare-rooms-candidates";

  name = "Compare Rooms Candidates";

  processInputStep({ messages, requestContext }: ProcessInputStepArgs) {
    stashCompareCandidates(requestContext, resolveCompareCandidates(messages));

    return messages;
  }
}
