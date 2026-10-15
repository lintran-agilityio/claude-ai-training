import { useEffect } from "react";

import { useHomestayAgentUiStore } from "@/features/chatbot/stores/homestay-agent-ui-store";
import type {
  HomestayAgentFocusType,
  HomestayAgentTaskStatus,
  HomestayAgentTaskType,
} from "@/features/chatbot/types";

type UiFocusTarget = {
  type: HomestayAgentFocusType;
  id: string;
};

/**
 * Registers an active UI focus slice for HomestayAgentContext (stacked by key).
 * Suggestion pills only — not booking step-machine authority.
 */
export const useReportHomestayAgentUiFocus = (
  active: boolean,
  key: string,
  task: { type: HomestayAgentTaskType; status: HomestayAgentTaskStatus },
  focus?: UiFocusTarget,
) => {
  const pushUiFocus = useHomestayAgentUiStore((state) => state.pushUiFocus);
  const popUiFocus = useHomestayAgentUiStore((state) => state.popUiFocus);

  useEffect(() => {
    if (!active) {
      return;
    }

    pushUiFocus({ key, task, focus });

    return () => {
      popUiFocus(key);
    };
  }, [
    active,
    focus?.id,
    focus?.type,
    key,
    popUiFocus,
    pushUiFocus,
    task.status,
    task.type,
  ]);
};

/** @deprecated Prefer `useReportHomestayAgentUiFocus`. */
export const useReportHomestayAgentWorkflow = useReportHomestayAgentUiFocus;
