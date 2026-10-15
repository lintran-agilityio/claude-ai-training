import type { Thread, ThreadDateGroup } from "@/features/chatbot/threads/types";

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getSortTime = (thread: Thread) =>
  (thread.lastRunAt ?? thread.updatedAt ?? thread.createdAt).getTime();

/**
 * Groups threads into Today / Yesterday / Older by last activity.
 */
export const groupThreadsByDate = (threads: Thread[]): ThreadDateGroup[] => {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const buckets: Record<ThreadDateGroup["key"], Thread[]> = {
    today: [],
    yesterday: [],
    older: [],
  };

  for (const thread of threads) {
    const activityDay = startOfDay(
      thread.lastRunAt ?? thread.updatedAt ?? thread.createdAt,
    );

    if (activityDay.getTime() === today.getTime()) {
      buckets.today.push(thread);
    } else if (activityDay.getTime() === yesterday.getTime()) {
      buckets.yesterday.push(thread);
    } else {
      buckets.older.push(thread);
    }
  }

  const sortNewestFirst = (left: Thread, right: Thread) =>
    getSortTime(right) - getSortTime(left);

  const groups: ThreadDateGroup[] = [
    { key: "today", label: "Today", threads: buckets.today.sort(sortNewestFirst) },
    {
      key: "yesterday",
      label: "Yesterday",
      threads: buckets.yesterday.sort(sortNewestFirst),
    },
    { key: "older", label: "Older", threads: buckets.older.sort(sortNewestFirst) },
  ];

  return groups.filter((group) => group.threads.length > 0);
};
