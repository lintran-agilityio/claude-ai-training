import { evalite } from "evalite";

import { TOOL_KEYS } from "@repo/constants";

import { runAgentTurn } from "../../support/agent-harness";
import { scoreResult } from "../../support/checks";
import { installFakeApi } from "../../support/fake-api";
import { FIXTURE_ROOMS } from "../../support/fixtures";
import { extractToolCalls } from "../../support/tool-calls";

/**
 * Compare flow on ONE thread, real model: a search paints Room List cards, then
 * the guest asks to compare. The comparison must show THOSE rooms — the
 * reported bug painted invented ones ("Ocean View Suite", "$250") because the
 * `generate_a2ui` designer never saw the search result. Now the model only
 * routes (`compare_rooms`, optionally narrowing `roomIds`) and the tool builds
 * the surface from the searched rooms, so this asserts routing + that the
 * compared names equal the searched names.
 */

type CompareTurnCase = {
  name: string;
  search: string;
  compare: string;
  /** Expected compared names; default = every searched room (up to 4). */
  expectedNames?: string[];
};

type CompareTurnResult = {
  searchedNames: string[];
  compareToolNames: string[];
  comparedNames: string[];
  compareStatus: string;
  text: string;
  error: string | null;
};

type ToolResultChunkLike = {
  payload?: { toolName?: string; result?: unknown };
};
type RawResult = {
  steps?: { toolResults?: ToolResultChunkLike[] }[];
  toolResults?: ToolResultChunkLike[];
};

/** Raw result of the last `toolName` call in a run. */
const toolResultOf = (result: RawResult, toolName: string): unknown => {
  const chunks = [
    ...(result.steps ?? []).flatMap((step) => step.toolResults ?? []),
    ...(result.toolResults ?? []),
  ];
  return chunks.filter((chunk) => chunk.payload?.toolName === toolName).at(-1)
    ?.payload?.result;
};

const roomNamesOf = (value: unknown): string[] =>
  ((value as { rooms?: { name?: string }[] } | undefined)?.rooms ?? [])
    .map((room) => room.name ?? "")
    .filter(Boolean);

/** Room names inside the RoomComparison root of a compare_rooms envelope. */
const comparedNamesOf = (value: unknown): string[] => {
  const operations =
    (value as { a2ui_operations?: Record<string, { components?: unknown[] }>[] })
      ?.a2ui_operations ?? [];
  const root = operations.find((op) => op.updateComponents)?.updateComponents
    ?.components?.[0];
  return roomNamesOf(root);
};

const [BAMBOO, RIVERSIDE] = FIXTURE_ROOMS;

// Two cases, four real turns: every turn also pays the prompt-injection
// detector call, so each case is ≥4 model calls on the free route. The
// Vietnamese heading and every selection edge case are covered without a
// model in `deterministic/compare-rooms.eval.ts`.
const cases: CompareTurnCase[] = [
  {
    name: "compare these rooms → the searched rooms",
    search: "Find rooms for 1 guest",
    compare: "please help compare these rooms",
  },
  {
    name: "named subset → only those rooms, via roomIds",
    search: "Find rooms for 1 guest",
    compare: `Compare ${RIVERSIDE!.name} and ${BAMBOO!.name}`,
    expectedNames: [RIVERSIDE!.name, BAMBOO!.name],
  },
];

const FORBIDDEN_IN_COMPARE_TURN = [
  TOOL_KEYS.BOOKING.GET_ROOM_BY_ID,
  TOOL_KEYS.GET.FIND_ROOM,
  "generate_a2ui",
  "render_a2ui",
];

evalite<CompareTurnCase, CompareTurnResult, CompareTurnCase>(
  "compare_rooms — 'compare' after a search compares the rooms on screen",
  {
    data: () => cases.map((c) => ({ input: c, expected: c })),
    task: async (input) => {
      const fakeApi = installFakeApi();
      const threadId = `eval-compare-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const search = await runAgentTurn(input.search, { threadId });
        const compare = await runAgentTurn(input.compare, { threadId });
        const compareResult = toolResultOf(
          compare.result as RawResult,
          TOOL_KEYS.GET.COMPARE_ROOMS,
        );

        return {
          searchedNames: roomNamesOf(
            toolResultOf(search.result as RawResult, TOOL_KEYS.GET.FIND_ROOM),
          ),
          compareToolNames: extractToolCalls(compare.result).map(
            (call) => call.toolName,
          ),
          comparedNames: comparedNamesOf(compareResult),
          compareStatus:
            (compareResult as { status?: string } | undefined)?.status ?? "(none)",
          text: compare.result.text ?? "",
          error: null,
        };
      } catch (caught) {
        return {
          searchedNames: [],
          compareToolNames: [],
          comparedNames: [],
          compareStatus: "(error)",
          text: "",
          error: caught instanceof Error ? caught.message : String(caught),
        };
      } finally {
        fakeApi.restore();
      }
    },
    scorers: [
      {
        name: "Compare turn routes to compare_rooms first",
        scorer: ({ output }) =>
          scoreResult(
            output.compareToolNames[0] === TOOL_KEYS.GET.COMPARE_ROOMS &&
              output.compareStatus === "rendered",
            output.error ??
              `tools [${output.compareToolNames.join(" → ") || "none"}], status ${output.compareStatus}`,
          ),
      },
      {
        name: "No detail / search / designer tool in the compare turn",
        scorer: ({ output }) => {
          const hit = FORBIDDEN_IN_COMPARE_TURN.filter((tool) =>
            output.compareToolNames.includes(tool),
          );
          return scoreResult(
            hit.length === 0,
            hit.length === 0 ? "none" : `unexpectedly called [${hit.join(", ")}]`,
          );
        },
      },
      {
        name: "Compared rooms are the searched rooms",
        scorer: ({ output, expected }) => {
          const want = expected!.expectedNames ?? output.searchedNames.slice(0, 4);
          return scoreResult(
            want.length > 0 && output.comparedNames.join(" | ") === want.join(" | "),
            `compared [${output.comparedNames.join(", ")}] vs expected [${want.join(", ")}] (searched [${output.searchedNames.join(", ")}])`,
          );
        },
      },
      {
        name: "Chat text names no room (the surface owns them)",
        scorer: ({ output }) => {
          const leaked = output.searchedNames.filter((name) =>
            output.text.toLowerCase().includes(name.toLowerCase()),
          );
          return scoreResult(
            leaked.length === 0,
            leaked.length === 0 ? `"${output.text}"` : `leaked [${leaked.join(", ")}] in "${output.text}"`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Case", value: input.name },
      { label: "Compare-turn tools", value: output.compareToolNames.join(" → ") || "(none)" },
      { label: "Compared", value: output.comparedNames.join(", ") || "(none)" },
      { label: "Reply", value: output.text },
    ],
  },
);
