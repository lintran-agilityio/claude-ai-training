import type { Thread } from "@/features/chatbot/threads/types";

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

/**
 * Renders relative day + time for a thread row, e.g. "Today · 10:32".
 */
export const formatThreadActivityLabel = (thread: Thread): string => {
  const activityAt = thread.lastRunAt ?? thread.updatedAt ?? thread.createdAt;
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const activityDay = startOfDay(activityAt);
  const time = timeFormatter.format(activityAt);

  if (activityDay.getTime() === today.getTime()) {
    return `Today · ${time}`;
  }

  if (activityDay.getTime() === yesterday.getTime()) {
    return `Yesterday · ${time}`;
  }

  return `${dateFormatter.format(activityAt)} · ${time}`;
};
