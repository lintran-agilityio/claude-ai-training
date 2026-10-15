import type { ReactNode } from "react";
import { Users } from "lucide-react";

import { cn } from "@repo/utils";

type RoomBookingSummaryHeaderProps = {
  label: string;
  name: string;
  capacityText: string;
  aside?: ReactNode;
  labelClassName?: string;
  nameClassName?: string;
  usersIconClassName?: string;
  capacityBadgeClassName?: string;
};

export const RoomBookingSummaryHeader = ({
  label,
  name,
  capacityText,
  aside,
  labelClassName,
  nameClassName,
  usersIconClassName = "size-4",
  capacityBadgeClassName,
}: RoomBookingSummaryHeaderProps) => {
  const capacityBadge = (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground",
        capacityBadgeClassName,
      )}
    >
      <Users className={usersIconClassName} />
      <span className="text-xs sm:text-sm">{capacityText}</span>
    </div>
  );

  return (
    <div className="flex items-start justify-between gap-3 sm:gap-4">
      <div className="space-y-1">
        <p
          className={cn(
            "text-xs font-medium uppercase tracking-[0.15em] text-gold",
            labelClassName,
          )}
        >
          {label}
        </p>
        <h2 className={cn("font-serif font-medium text-foreground", nameClassName)}>
          {name}
        </h2>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {aside}
        {capacityBadge}
      </div>
    </div>
  );
};
