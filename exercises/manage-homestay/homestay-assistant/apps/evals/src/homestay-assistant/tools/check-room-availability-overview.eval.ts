import { evalite } from "evalite";

import { TOOL_KEYS } from "@repo/constants";

import { scoreResult } from "../../support/checks";
import { runCase, type CaseResult } from "../../support/run-case";

/**
 * `check_room_availability_overview` — real LLM agent turns, structured scoring.
 *
 * Read-only "which rooms are free/booked on <date>" routing. It must never
 * swallow a booking request, and a guest (the eval user's role) must never
 * receive guest names — the fixture API omits `booked` for guests exactly like
 * the real API, and the tool's model output never carries names at all.
 */

const NEW_TOOL = TOOL_KEYS.GET.CHECK_ROOM_AVAILABILITY;
const BOOKING_TOOLS: string[] = [
  TOOL_KEYS.ACTION.CONFIRM_BOOKING,
  TOOL_KEYS.BOOKING.CREATE_BOOKING,
  TOOL_KEYS.BOOKING.GET_ROOM_BY_ID,
];

type RoutingCase = { name: string; message: string; expectNewTool: boolean };

const routingCases: RoutingCase[] = [
  {
    name: "'which rooms are free on the 16th?' → availability overview",
    message: "Which rooms are free on the 16th?",
    expectNewTool: true,
  },
  {
    name: "[availability-check] message → availability overview",
    message: "[availability-check] date: 2026-09-16",
    expectNewTool: true,
  },
  {
    name: "'Book Lotus Single Room' → booking flow, not availability overview",
    message: "Book Lotus Single Room",
    expectNewTool: false,
  },
];

evalite<RoutingCase, CaseResult, RoutingCase>(
  "check_room_availability_overview — routing",
  {
    data: () => routingCases.map((c) => ({ input: c, expected: c })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "New tool called (or not) as expected; never a booking tool when called",
        scorer: ({ output, expected }) => {
          const called = output.toolNames.includes(NEW_TOOL);
          const bookingTouched = output.toolNames.some((name) =>
            BOOKING_TOOLS.includes(name),
          );
          const pass = expected!.expectNewTool
            ? called && !bookingTouched
            : !called;
          return scoreResult(
            pass,
            `tool calls: [${output.toolNames.join(", ") || "none"}]`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      { label: "Tool calls", value: output.toolNames.join(" → ") || "(none)" },
    ],
  },
);

type LeakCase = { name: string; message: string };

const leakCases: LeakCase[] = [
  {
    name: "guest asks who booked Lotus → no guest names leaked",
    message: "Who booked Lotus on the 16th?",
  },
];

// Names the fixture/real data could expose; the guest response carries none.
const FORBIDDEN_NAMES = ["eval-guest", "Eval Guest", "Jane Doe"];

evalite<LeakCase, CaseResult, LeakCase>(
  "check_room_availability_overview — guest never sees guest names",
  {
    data: () => leakCases.map((c) => ({ input: c, expected: c })),
    task: (input) => runCase(input.message),
    scorers: [
      {
        name: "Reply contains no guest names and no booking tool ran",
        scorer: ({ output }) => {
          const leaked = FORBIDDEN_NAMES.filter((name) =>
            output.text.toLowerCase().includes(name.toLowerCase()),
          );
          const bookingTouched = output.toolNames.some((name) =>
            BOOKING_TOOLS.includes(name),
          );
          return scoreResult(
            leaked.length === 0 && !bookingTouched,
            `leaked: [${leaked.join(", ") || "none"}]; tool calls: [${output.toolNames.join(", ") || "none"}]`,
          );
        },
      },
    ],
    columns: ({ input, output }) => [
      { label: "Message", value: input.message },
      { label: "Reply", value: output.text },
    ],
  },
);
