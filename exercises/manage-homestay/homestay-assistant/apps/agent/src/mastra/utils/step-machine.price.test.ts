import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProcessInputStepArgs } from "@mastra/core/processors";
import { TOOL_KEYS } from "@repo/constants";

import { resolveEnforcedTransition } from "./step-machine";

const args = {} as ProcessInputStepArgs;
const run = (purpose?: string) =>
  resolveEnforcedTransition(args, {
    toolName: TOOL_KEYS.GET.CALCULATE_PRICE,
    input: { purpose },
    output: { total: 1 },
  });

describe("calculate_price transitions", () => {
  it("forces confirm_booking in the booking flow", () => {
    assert.deepEqual(run("booking"), {
      type: "call",
      toolName: TOOL_KEYS.ACTION.CONFIRM_BOOKING,
    });
  });
  it("stops after a plain quote", () => {
    assert.deepEqual(run(), { type: "stop" });
  });
});
