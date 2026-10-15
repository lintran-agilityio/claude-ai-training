import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { addDays, startOfDay, toDateKey, cn } from "@repo/utils";
import { CalendarDateButton } from "@/components/calendar";

type DateStripProps = {
  label: string;
  selectedDate: Date | null;
  minDate?: Date;
  disabled?: boolean;
  onSelect: (date: Date) => void;
};

// Number of days shown at once. Kept small so every day fits the booking
// card without an inner horizontal scrollbar competing with the prev/next
// arrows.
const WINDOW_SIZE = 5;
const WINDOW_CENTER_OFFSET = Math.floor(WINDOW_SIZE / 2);

const windowStartFor = (anchor: Date) =>
  startOfDay(addDays(anchor, -WINDOW_CENTER_OFFSET));

export const DateSelected = ({
  label,
  selectedDate,
  minDate,
  disabled = false,
  onSelect,
}: DateStripProps) => {
  const today = startOfDay(new Date());
  // Stable primitives so effects react to real value changes, not to the fresh
  // Date instances the parent hands us on every render.
  const rangeStartMs = startOfDay(minDate ?? today).getTime();
  const selectedMs = selectedDate ? startOfDay(selectedDate).getTime() : null;

  const [windowStart, setWindowStart] = useState(() =>
    selectedMs != null ? windowStartFor(new Date(selectedMs)) : new Date(rangeStartMs),
  );

  // Recentre the strip only when the selected date genuinely changes (e.g. the
  // modify-booking modal prefills a stay, or the guest picks a day that isn't
  // currently visible). Paging with the arrows leaves `selectedMs` untouched,
  // so this never yanks the window back while the guest is browsing.
  const previousSelectedMsRef = useRef(selectedMs);
  useEffect(() => {
    const previousSelectedMs = previousSelectedMsRef.current;
    previousSelectedMsRef.current = selectedMs;

    if (selectedMs === previousSelectedMs || selectedMs == null) {
      return;
    }

    setWindowStart((current) => {
      const windowEnd = addDays(current, WINDOW_SIZE - 1).getTime();
      const isVisible = selectedMs >= current.getTime() && selectedMs <= windowEnd;
      return isVisible ? current : windowStartFor(new Date(selectedMs));
    });
  }, [selectedMs]);

  // With no selection, follow the earliest bookable day forward (e.g. picking a
  // check-in date pushes the minimum check-out), so the strip never opens on a
  // run of greyed-out past days. Only ever moves forward, so it can't fight the
  // arrows.
  const hasSelection = selectedMs != null;
  useEffect(() => {
    if (hasSelection) {
      return;
    }

    setWindowStart((current) =>
      current.getTime() < rangeStartMs ? new Date(rangeStartMs) : current,
    );
  }, [hasSelection, rangeStartMs]);

  const dates = useMemo(
    () =>
      Array.from({ length: WINDOW_SIZE }, (_, index) =>
        addDays(windowStart, index),
      ),
    [windowStart],
  );

  // Track the days actually on screen, not the (possibly paged-away) selection.
  const monthLabel = (dates[WINDOW_CENTER_OFFSET] ?? windowStart).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  // Nothing bookable lives before the current window's first day, so stepping
  // further back would only reveal greyed-out days.
  const canGoPrev = windowStart.getTime() > rangeStartMs;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{monthLabel}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Previous ${label.toLowerCase()} dates`}
          disabled={disabled || !canGoPrev}
          onClick={() =>
            setWindowStart((current) => {
              const previous = addDays(current, -WINDOW_SIZE);
              return previous.getTime() < rangeStartMs
                ? new Date(rangeStartMs)
                : previous;
            })
          }
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div
          className="grid flex-1 gap-1"
          style={{
            gridTemplateColumns: `repeat(${WINDOW_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {dates.map((date) => {
            const isDisabled =
              disabled || (minDate ? date < minDate : date < today);
            const isSelected =
              selectedDate != null &&
              toDateKey(selectedDate) === toDateKey(date);

            return (
              <CalendarDateButton
                key={toDateKey(date)}
                date={date}
                isSelected={isSelected}
                onSelect={(nextDate) => {
                  if (!isDisabled) {
                    onSelect(nextDate);
                  }
                }}
                className={cn(isDisabled && "pointer-events-none opacity-30")}
              />
            );
          })}
        </div>

        <button
          type="button"
          aria-label={`Next ${label.toLowerCase()} dates`}
          disabled={disabled}
          onClick={() =>
            setWindowStart((current) => addDays(current, WINDOW_SIZE))
          }
          className="flex size-8 shrink-0 items-center justify-center rounded-full cursor-pointer border border-border text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
};
