import { evalite } from "evalite";

import type { MastraDBMessage } from "@mastra/core/agent";
import type { ProcessInputStepArgs } from "@mastra/core/processors";
import { RequestContext } from "@mastra/core/request-context";
import { TOOL_KEYS, TOOL_PURPOSE, type FindRoomPurpose } from "@repo/constants";
import {
  ROOM_COMPARISON_CATALOG_ID,
  ROOM_COMPARISON_COMPONENT,
  roomComparisonPropsSchema,
  type Room,
} from "@repo/schemas";

import { CompareRoomsCandidatesProcessor } from "@agent/mastra/processors/compare-rooms-candidates.processor";
import { compareRoomsTool } from "@agent/mastra/tools/rooms/compare-rooms";

import { scoreResult } from "../../support/checks";
import { enforceStepEval } from "../../support/enforce-step-contract";
import { FIXTURE_ROOMS } from "../../support/fixtures";

/**
 * `compare_rooms` — the RoomComparison is built from the rooms on screen, no LLM.
 *
 * The comparison used to come from the auto-injected `generate_a2ui` designer
 * subagent, which never saw the `find_room` result (tool results are stripped
 * from its messages, and its `changes` brief is dropped on create) — so "compare
 * these rooms" under three real cards painted three invented rooms. These cases
 * drive the real pipeline end to end: CompareRoomsCandidatesProcessor pins the
 * transcript's latest search → `compareRoomsTool.execute` → the
 * `a2ui_operations` envelope the A2UIMiddleware paints.
 */

const [BAMBOO, RIVERSIDE, LOTUS] = FIXTURE_ROOMS as [Room, Room, Room];

const EXTRA_ROOMS: Room[] = [4, 5, 6].map((n) => ({
  ...LOTUS,
  id: `room-extra-${n}`,
  name: `Extra Room ${n}`,
}));

/** One conversation entry, oldest → newest. */
type HistoryEntry =
  | { user: string }
  | { findRoom: Room[]; purpose?: FindRoomPurpose };

type CompareCase = {
  name: string;
  history: HistoryEntry[];
  roomIds?: string[];
  expected: {
    status: "rendered" | "no_candidates";
    /** Room names on the surface, in order. */
    names?: string[];
    title?: string;
    /** Whether the "showing the first N" note is present. */
    trimmedNote?: boolean;
  };
};

type CompareSummary = {
  status: string;
  catalogId?: string;
  component?: string;
  surfaceId?: string;
  propsError?: string;
  names: string[];
  title?: string;
  note?: string;
};

const toMessages = (history: HistoryEntry[]): MastraDBMessage[] =>
  history.map((entry, index) =>
    "user" in entry
      ? ({
          id: `eval-user-${index}`,
          role: "user",
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: "text", text: entry.user }] },
        } as unknown as MastraDBMessage)
      : ({
          id: `eval-assistant-${index}`,
          role: "assistant",
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              {
                type: "tool-invocation",
                toolInvocation: {
                  state: "result",
                  toolCallId: `eval-find-room-${index}`,
                  toolName: TOOL_KEYS.GET.FIND_ROOM,
                  args: { purpose: entry.purpose },
                  result: { rooms: entry.findRoom, purpose: entry.purpose },
                },
              },
            ],
          },
        } as unknown as MastraDBMessage),
  );

type OperationRecord = Record<string, Record<string, unknown> | undefined>;

const summarize = (output: unknown): CompareSummary => {
  const record = (output ?? {}) as {
    status?: string;
    a2ui_operations?: OperationRecord[];
  };
  const operations = record.a2ui_operations ?? [];
  const create = operations.find((op) => op.createSurface)?.createSurface;
  const update = operations.find((op) => op.updateComponents)?.updateComponents;
  const [root] = (update?.components ?? []) as Record<string, unknown>[];
  const { id: _id, component, ...props } = root ?? {};
  const parsed = roomComparisonPropsSchema.safeParse(props);

  return {
    status: record.status ?? "(none)",
    catalogId: create?.catalogId as string | undefined,
    component: component as string | undefined,
    surfaceId: create?.surfaceId as string | undefined,
    propsError: root && !parsed.success ? parsed.error.message : undefined,
    names: parsed.success ? parsed.data.rooms.map((room) => room.name) : [],
    title: parsed.success ? parsed.data.title : undefined,
    note: parsed.success ? parsed.data.note : undefined,
  };
};

const runCompare = async (testCase: CompareCase): Promise<CompareSummary> => {
  const requestContext = new RequestContext();
  new CompareRoomsCandidatesProcessor().processInputStep({
    messages: toMessages(testCase.history),
    requestContext,
  } as unknown as ProcessInputStepArgs);

  const output = await compareRoomsTool.execute!(
    testCase.roomIds ? { roomIds: testCase.roomIds } : {},
    { requestContext, agent: { toolCallId: "eval-compare-call" } } as unknown as Parameters<
      NonNullable<typeof compareRoomsTool.execute>
    >[1],
  );

  return summarize(output);
};

const SEARCH = TOOL_PURPOSE.FIND_ROOM.SEARCH;
const ALL_THREE = [BAMBOO.name, RIVERSIDE.name, LOTUS.name];

const cases: CompareCase[] = [
  {
    // The screenshot: three cards, then "compare these" painted invented rooms.
    name: "3-room search → compares exactly those 3, in search order",
    history: [
      { user: "Find rooms for 2 guests" },
      { findRoom: FIXTURE_ROOMS, purpose: SEARCH },
      { user: "please help compare these room" },
    ],
    expected: {
      status: "rendered",
      names: ALL_THREE,
      title: "Room comparison",
      trimmedNote: false,
    },
  },
  {
    name: "recommend results are comparable too",
    history: [
      { findRoom: [RIVERSIDE, LOTUS], purpose: TOOL_PURPOSE.FIND_ROOM.RECOMMEND },
      { user: "which one is cheaper?" },
    ],
    expected: { status: "rendered", names: [RIVERSIDE.name, LOTUS.name] },
  },
  {
    name: "search with no purpose (default search) is comparable",
    history: [{ findRoom: FIXTURE_ROOMS }, { user: "compare them" }],
    expected: { status: "rendered", names: ALL_THREE },
  },
  {
    name: "named subset → only those rooms, in the guest's order",
    history: [
      { findRoom: FIXTURE_ROOMS, purpose: SEARCH },
      { user: "compare Riverside and Bamboo" },
    ],
    roomIds: [RIVERSIDE.id, BAMBOO.id],
    expected: { status: "rendered", names: [RIVERSIDE.name, BAMBOO.name] },
  },
  {
    name: "an id that is not on screen is ignored — never adds a room",
    history: [
      { findRoom: FIXTURE_ROOMS, purpose: SEARCH },
      { user: "compare Riverside with the ocean view suite" },
    ],
    roomIds: [RIVERSIDE.id, "room-ocean-view-suite"],
    expected: { status: "rendered", names: [RIVERSIDE.name] },
  },
  {
    name: "every id invented → falls back to the displayed rooms",
    history: [
      { findRoom: FIXTURE_ROOMS, purpose: SEARCH },
      { user: "compare these rooms" },
    ],
    roomIds: ["room-ocean-view-suite", "room-mountain-retreat"],
    expected: { status: "rendered", names: ALL_THREE },
  },
  {
    name: "6 rooms on screen → first 4 + a trimmed note",
    history: [
      { findRoom: [...FIXTURE_ROOMS, ...EXTRA_ROOMS], purpose: SEARCH },
      { user: "compare all of them" },
    ],
    expected: {
      status: "rendered",
      names: [...ALL_THREE, EXTRA_ROOMS[0]!.name],
      trimmedNote: true,
    },
  },
  {
    name: "the newest search wins over an older one",
    history: [
      { findRoom: FIXTURE_ROOMS, purpose: SEARCH },
      { user: "now only rooms for 2 guests" },
      { findRoom: [BAMBOO, RIVERSIDE], purpose: SEARCH },
      { user: "compare these" },
    ],
    expected: { status: "rendered", names: [BAMBOO.name, RIVERSIDE.name] },
  },
  {
    name: "book_resolve / resolve lookups after the search are not the list on screen",
    history: [
      { findRoom: FIXTURE_ROOMS, purpose: SEARCH },
      { findRoom: [BAMBOO], purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      { findRoom: [RIVERSIDE], purpose: TOOL_PURPOSE.FIND_ROOM.RESOLVE },
      { user: "compare the rooms you listed" },
    ],
    expected: { status: "rendered", names: ALL_THREE },
  },
  {
    name: "a newer empty search does not hide the cards above",
    history: [
      { findRoom: FIXTURE_ROOMS, purpose: SEARCH },
      { findRoom: [], purpose: SEARCH },
      { user: "ok, compare the earlier rooms" },
    ],
    expected: { status: "rendered", names: ALL_THREE },
  },
  {
    name: "Vietnamese request → Vietnamese heading",
    history: [
      { findRoom: FIXTURE_ROOMS, purpose: SEARCH },
      { user: "so sánh 3 phòng vừa rồi" },
    ],
    expected: { status: "rendered", names: ALL_THREE, title: "So sánh phòng" },
  },
  {
    name: "no search in the conversation → no_candidates (nothing painted)",
    history: [{ user: "compare your rooms" }],
    expected: { status: "no_candidates" },
  },
  {
    name: "only a book_resolve lookup → no_candidates",
    history: [
      { findRoom: [BAMBOO], purpose: TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE },
      { user: "compare it" },
    ],
    expected: { status: "no_candidates" },
  },
];

evalite<CompareCase, CompareSummary, CompareCase["expected"]>(
  "compare_rooms — the comparison shows the rooms on screen",
  {
    data: () => cases.map((c) => ({ input: c, expected: c.expected })),
    task: (input) => runCompare(input),
    scorers: [
      {
        name: "Compares exactly the displayed rooms",
        scorer: ({ output, expected }) => {
          const problems: string[] = [];
          if (output.status !== expected!.status) {
            problems.push(`status "${output.status}" ≠ "${expected!.status}"`);
          }
          if (
            expected!.names &&
            output.names.join(" | ") !== expected!.names.join(" | ")
          ) {
            problems.push(
              `rooms [${output.names.join(", ")}] ≠ [${expected!.names.join(", ")}]`,
            );
          }
          if (expected!.title !== undefined && output.title !== expected!.title) {
            problems.push(`title "${output.title}" ≠ "${expected!.title}"`);
          }
          if (
            expected!.trimmedNote !== undefined &&
            Boolean(output.note) !== expected!.trimmedNote
          ) {
            problems.push(`note ${JSON.stringify(output.note)}`);
          }
          return scoreResult(
            problems.length === 0,
            problems.length === 0 ? "matched" : problems.join("; "),
          );
        },
      },
      {
        name: "Well-formed RoomComparison A2UI envelope",
        scorer: ({ output }) => {
          if (output.status !== "rendered") {
            return scoreResult(true, "nothing rendered — no envelope expected");
          }
          const problems: string[] = [];
          if (output.catalogId !== ROOM_COMPARISON_CATALOG_ID) {
            problems.push(`catalogId "${output.catalogId}"`);
          }
          if (output.component !== ROOM_COMPARISON_COMPONENT) {
            problems.push(`root component "${output.component}"`);
          }
          if (!output.surfaceId?.startsWith("room-comparison-")) {
            problems.push(`surfaceId "${output.surfaceId}"`);
          }
          if (output.propsError) {
            problems.push(`props fail the shared schema: ${output.propsError}`);
          }
          return scoreResult(
            problems.length === 0,
            problems.length === 0 ? "envelope ok" : problems.join("; "),
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Case", value: input.name },
      { label: "Status", value: output.status },
      { label: "Rooms", value: output.names.join(", ") || "(none)" },
    ],
  },
);

/**
 * A painted comparison owns the turn: the step machine stops it so the model
 * can only add its pointer sentence — never `get_room_by_id` per room (three
 * Booking Forms) or another search. `no_candidates` painted nothing, so the
 * model stays free to search or ask which rooms to compare.
 */
const renderedCompare = {
  toolName: TOOL_KEYS.GET.COMPARE_ROOMS,
  output: { status: "rendered", roomCount: 3, a2ui_operations: [] },
};

enforceStepEval("compare_rooms — a painted comparison ends the turn", [
  {
    name: "compare_rooms rendered → stop",
    transcript: [renderedCompare],
    expected: "stop",
  },
  {
    name: "compare_rooms no_candidates → no forced step",
    transcript: [
      { toolName: TOOL_KEYS.GET.COMPARE_ROOMS, output: { status: "no_candidates" } },
    ],
    expected: "pass",
  },
  {
    name: "search → compare in one turn → stop after the comparison",
    transcript: [
      {
        toolName: TOOL_KEYS.GET.FIND_ROOM,
        input: { purpose: TOOL_PURPOSE.FIND_ROOM.SEARCH },
        output: { rooms: FIXTURE_ROOMS, purpose: TOOL_PURPOSE.FIND_ROOM.SEARCH },
      },
      renderedCompare,
    ],
    expected: "stop",
  },
  {
    name: "live message shape · compare_rooms rendered → stop",
    liveMessageShape: true,
    transcript: [renderedCompare],
    expected: "stop",
  },
]);
