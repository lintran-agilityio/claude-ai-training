import { ToolCallStatus } from "@copilotkit/react-core/v2";

export type ToolRendererStatus =
  | ToolCallStatus
  | "inProgress"
  | "executing"
  | "complete";

export type ToolRendererProps<TResult> = {
  status: ToolRendererStatus;
  result?: TResult | string | null;
  toolCallId?: string;
};
