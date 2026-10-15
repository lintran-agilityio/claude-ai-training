import type {
  HomestayAgentScreenName,
  HomestayAgentTaskStatus,
  HomestayAgentTaskType,
} from "@repo/constants";

export type {
  HomestayAgentScreenName,
  HomestayAgentTaskStatus,
  HomestayAgentTaskType,
};

export type HomestayAgentFocusType = "room" | "booking";

export type HomestayAgentContext = {
  screen: {
    name: HomestayAgentScreenName;
  };
  focus?: {
    type: HomestayAgentFocusType;
    id: string;
    // name: string;
  };
  task?: {
    type: HomestayAgentTaskType;
    status: HomestayAgentTaskStatus;
  };
};
