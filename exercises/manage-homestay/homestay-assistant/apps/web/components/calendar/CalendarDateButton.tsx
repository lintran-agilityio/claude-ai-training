"use client";

import { cn } from "@repo/utils";

type CalendarDateButtonProps = {
  date: Date;
  isSelected: boolean;
  onSelect: (date: Date) => void;
  className?: string;
};

export const CalendarDateButton = ({
  date,
  isSelected,
  onSelect,
  className,
}: CalendarDateButtonProps) => {
  const weekday = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      className={cn(
        "flex w-full min-w-0 flex-col items-center rounded-xl px-1 py-1 transition-colors text-xs cursor-pointer",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <span className="text-[10px] font-medium tracking-[0.12em]">
        {weekday}
      </span>
      <span className="mt-1 text-xs font-medium">{date.getDate()}</span>
    </button>
  );
};
