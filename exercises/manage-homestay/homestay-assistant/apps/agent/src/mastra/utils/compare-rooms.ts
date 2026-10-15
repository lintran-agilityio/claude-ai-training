/**
 * Room comparison, built in code.
 *
 * The RoomComparison A2UI surface must show the rooms the guest is looking at —
 * the Room List cards of the latest search/recommend `find_room`. It used to be
 * designed by the auto-injected `generate_a2ui` subagent, which never received
 * that data: `@ag-ui/mastra` strips every tool result from the subagent's
 * messages and `@ag-ui/a2ui-toolkit` drops the `changes` brief on
 * `intent: "create"`, so it invented rooms. Everything here is deterministic:
 *   1. {@link resolveCompareCandidates} reads the rooms off the transcript
 *      (pinned each step by CompareRoomsCandidatesProcessor),
 *   2. {@link selectCompareRooms} narrows them to the guest's named subset,
 *   3. {@link toRoomComparisonProps} + {@link buildRoomComparisonEnvelope} turn
 *      them into the `a2ui_operations` envelope the A2UIMiddleware paints.
 */
import type { ProcessInputStepArgs } from "@mastra/core/processors";
import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";

import { TOOL_KEYS, VIETNAMESE_LETTER } from "@repo/constants";
import {
  ROOM_COMPARISON_CATALOG_ID,
  ROOM_COMPARISON_COMPONENT,
  ROOM_COMPARISON_HIGHLIGHT_MAX,
  ROOM_COMPARISON_MAX,
  roomComparisonPropsSchema,
  roomSchema,
  type Room,
  type RoomComparisonProps,
} from "@repo/schemas";
import { formatPrice } from "@repo/utils";

import { REQUEST_CONTEXT_KEYS } from "@/mastra/middleware/constants";
import { asRecord } from "@/mastra/utils/json-value";
import {
  extractMessageText,
  findLatestUserMessage,
} from "@/mastra/utils/latest-user-message";
import { getMessageParts } from "@/mastra/utils/message-parts";
import { parseFindRoomOutput } from "@/mastra/utils/parse-tool-output";
import { COMPARE_ELIGIBLE_PURPOSES } from "@/mastra/utils/room";

/** Key the A2UIMiddleware looks for in any tool result to paint a surface. */
export const A2UI_OPERATIONS_KEY = "a2ui_operations";

/** A2UI protocol version of the emitted operations. */
const A2UI_VERSION = "v0.9";

export type CompareLanguage = "en" | "vi";

const compareCandidatesSchema = z.object({
  rooms: z.array(roomSchema).min(1),
  language: z.enum(["en", "vi"]),
});

/** The rooms on screen (latest search/recommend find_room) + guest language. */
export type CompareCandidates = z.infer<typeof compareCandidatesSchema>;

/**
 * Rooms of the newest search/recommend `find_room` result in the whole
 * conversation that returned at least one room — the raw result
 * `FindRoomNotice` rendered the Room List cards from (already trimmed by
 * `limit`). `book_resolve` / `resolve` lookups and empty searches are skipped.
 */
const latestDisplayedRooms = (
  messages: ProcessInputStepArgs["messages"],
): Room[] | null => {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const parts = getMessageParts(messages[messageIndex]);
    if (!parts) continue;

    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const record = asRecord(parts[partIndex]);
      if (record?.type !== "tool-invocation") continue;

      const invocation = asRecord(record.toolInvocation);
      if (
        invocation?.state !== "result" ||
        invocation.toolName !== TOOL_KEYS.GET.FIND_ROOM
      ) {
        continue;
      }

      const result = parseFindRoomOutput(invocation.result);
      if (
        result &&
        COMPARE_ELIGIBLE_PURPOSES.has(result.purpose) &&
        result.rooms.length > 0
      ) {
        return result.rooms;
      }
    }
  }

  return null;
};

/** Vietnamese when the guest's latest message has VI letters, else English. */
const latestUserLanguage = (
  messages: ProcessInputStepArgs["messages"],
): CompareLanguage => {
  const latest = findLatestUserMessage(messages);

  return latest && VIETNAMESE_LETTER.test(extractMessageText(latest))
    ? "vi"
    : "en";
};

/**
 * The rooms `compare_rooms` may compare — the Room List the guest sees — or
 * null when no search/recommend `find_room` in the conversation returned rooms.
 */
export const resolveCompareCandidates = (
  messages: ProcessInputStepArgs["messages"] | undefined,
): CompareCandidates | null => {
  if (!messages?.length) {
    return null;
  }

  const rooms = latestDisplayedRooms(messages);

  return rooms ? { rooms, language: latestUserLanguage(messages) } : null;
};

/** Pins the candidates so the compare_rooms tool can read them this step. */
export const stashCompareCandidates = (
  requestContext: RequestContext | undefined,
  candidates: CompareCandidates | null,
) => {
  requestContext?.set(
    REQUEST_CONTEXT_KEYS.PENDING_COMPARE_ROOMS,
    candidates ?? undefined,
  );
};

/** Reads the pinned candidates; malformed/missing values return null. */
export const readCompareCandidates = (
  requestContext: RequestContext | undefined,
): CompareCandidates | null => {
  const parsed = compareCandidatesSchema.safeParse(
    requestContext?.get(REQUEST_CONTEXT_KEYS.PENDING_COMPARE_ROOMS),
  );

  return parsed.success ? parsed.data : null;
};

/**
 * The guest's named subset of the displayed rooms, in the order requested.
 * Ids that are not on screen are ignored — the model can narrow the list but
 * never add a room to it. No (valid) id → every displayed room.
 */
export const selectCompareRooms = (
  candidates: Room[],
  roomIds?: readonly string[],
): Room[] => {
  const byId = new Map(candidates.map((room) => [room.id, room]));
  const picked = [...new Set(roomIds ?? [])].flatMap((id) => {
    const room = byId.get(id);
    return room ? [room] : [];
  });

  return picked.length > 0 ? picked : candidates;
};

const COMPARE_COPY: Record<
  CompareLanguage,
  {
    eyebrow: string;
    title: string;
    perNight: string;
    available: string;
    fullyBooked: string;
    trimmed: (shown: number, total: number) => string;
  }
> = {
  en: {
    eyebrow: "Your shortlisted stays",
    title: "Room comparison",
    perNight: "/ night",
    available: "Available",
    fullyBooked: "Fully booked",
    trimmed: (shown, total) =>
      `Showing the first ${shown} of ${total} rooms from your search.`,
  },
  vi: {
    eyebrow: "Phòng bạn đang cân nhắc",
    title: "So sánh phòng",
    perNight: "/ đêm",
    available: "Còn phòng",
    fullyBooked: "Hết phòng",
    trimmed: (shown, total) =>
      `Đang hiển thị ${shown} trên ${total} phòng từ kết quả tìm kiếm.`,
  },
};

/**
 * RoomComparison props from verified rooms. Caps the list at
 * `ROOM_COMPARISON_MAX` and says so in `note` when rooms were left out.
 */
export const toRoomComparisonProps = (
  rooms: Room[],
  language: CompareLanguage,
): RoomComparisonProps => {
  const copy = COMPARE_COPY[language];
  const shown = rooms.slice(0, ROOM_COMPARISON_MAX);

  return roomComparisonPropsSchema.parse({
    eyebrow: copy.eyebrow,
    title: copy.title,
    ...(rooms.length > shown.length
      ? { note: copy.trimmed(shown.length, rooms.length) }
      : {}),
    rooms: shown.map((room) => {
      const price = formatPrice(room.pricePerNight);

      return {
        id: room.id,
        name: room.name,
        level: room.level,
        levelColor: room.levelColor,
        capacity: room.capacity,
        imageUrl: room.imageUrl,
        nightlyRate: price ? `${price} ${copy.perNight}` : "",
        availability:
          room.availableSlots > 0 ? copy.available : copy.fullyBooked,
        highlights: room.amenities.slice(0, ROOM_COMPARISON_HIGHLIGHT_MAX),
      };
    }),
  });
};

/**
 * `{ a2ui_operations }` envelope painting ONE root `RoomComparison` on a new
 * surface — the op shapes `@ag-ui/a2ui-toolkit`'s `createSurface` /
 * `updateComponents` emit. The A2UIMiddleware detects it on the tool result
 * and renders it with the web catalog; no layout wrapper is needed.
 */
export const buildRoomComparisonEnvelope = (
  surfaceId: string,
  props: RoomComparisonProps,
) => ({
  [A2UI_OPERATIONS_KEY]: [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId, catalogId: ROOM_COMPARISON_CATALOG_ID },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId,
        components: [
          { id: "root", component: ROOM_COMPARISON_COMPONENT, ...props },
        ],
      },
    },
  ],
});
