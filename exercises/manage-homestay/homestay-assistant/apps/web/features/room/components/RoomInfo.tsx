import { AmenitiesRoom } from "@/features/room/components/AmenitiesRoom";
import type { Amenity } from "@/features/room/types/room";
import { cn } from "@repo/utils";

type RoomInfoProps = {
  name: string;
  description: string;
  amenities: Amenity[];
  compact?: boolean;
  className?: string;
};

export const RoomInfo = ({
  name,
  description,
  amenities,
  compact = false,
  className,
}: RoomInfoProps) => {
  return (
    <div className={cn("flex flex-col gap-3 p-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <h3
          className={cn(
            // Reserve two lines so name length never shifts the rows below it
            // out of alignment with sibling cards in the grid.
            "line-clamp-2 min-h-[18h] font-serif font-medium text-foreground",
            compact ? "text-base" : "text-lg",
          )}
        >
          {name}
        </h3>
      </div>

      <p
        className={cn(
          "leading-relaxed text-muted-foreground",
          compact ? "line-clamp-2 text-xs" : "line-clamp-3 text-sm",
        )}
      >
        {description}
      </p>

      <AmenitiesRoom amenities={amenities} />
    </div>
  );
}
