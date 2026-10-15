export type ThreadStatus = "active" | "archived";

export type Thread = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  status?: ThreadStatus;
  messageCount: number;
  agentId: string;
  lastRunAt?: Date;
};

export type ThreadLoadingState = "idle" | "loading" | "loaded" | "error";

export type ThreadDateGroupKey = "today" | "yesterday" | "older";

export type ThreadDateGroup = {
  key: ThreadDateGroupKey;
  label: string;
  threads: Thread[];
};
