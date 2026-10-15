import type { ReactNode } from "react";

import { EmptyMessages } from "@repo/components";
import { cn } from "@repo/utils";

type CardListSectionProps<T> = {
  items: T[];
  title?: string;
  /** Singular noun for the title count suffix, e.g. "room" or "booking". */
  itemLabel?: string;
  emptyMessage: string;
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  compact?: boolean;
  className?: string;
};

/**
 * Shared card-grid layout for room and booking lists: title with a result
 * count, responsive card grid, and a centered empty state. Keeps Find Room
 * and My Bookings visually identical — only the card renderer differs.
 */
export const CardListSection = <T,>({
  items,
  title,
  itemLabel = "room",
  emptyMessage,
  renderItem,
  getItemKey,
  compact = false,
  className,
}: CardListSectionProps<T>) => {
  const lengthItem = items.length;

  if (!lengthItem) {
    return (
      <section
        className={cn(
          "flex h-full items-center justify-center",
          className,
        )}
      >
        <EmptyMessages emptyMessage={emptyMessage} />
      </section>
    );
  }

  return (
    <section className={cn("space-y-4", className)}>
      {title ? (
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gold" />
          <h2 className="font-serif text-lg font-medium text-foreground">
            {title}{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              ({lengthItem} {itemLabel}
              {lengthItem > 1 ? "s" : ""})
            </span>
          </h2>
        </div>
      ) : null}

      <div
        className={cn(
          "app-scrollbar grid",
          compact
            ? "max-h-[50vh] gap-3 overflow-y-auto pr-1 grid-cols-2"
            : "grid-cols-1 gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {items.map((item, index) => (
          <div key={getItemKey(item, index)}>{renderItem(item, index)}</div>
        ))}
      </div>
    </section>
  );
};
