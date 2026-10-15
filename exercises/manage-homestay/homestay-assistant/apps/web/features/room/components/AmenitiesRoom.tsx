// Libs
import {
  Coffee,
  Mic,
  Monitor,
  Phone,
  Wifi,
  type LucideIcon,
} from "lucide-react";

// Types
import type { Amenity } from "@/features/room/types/room";
import { cn } from "@repo/utils";

const AMENITY_ICONS = {
  monitor: Monitor,
  coffee: Coffee,
  mic: Mic,
  wifi: Wifi,
  video: Monitor,
  whiteboard: Monitor,
  phone: Phone,
} satisfies Partial<Record<Amenity, LucideIcon>>;

type AmenitiesRoomProps = {
  amenities: Amenity[];
  className?: string;
};

export const AmenitiesRoom = ({ amenities = [], className }: AmenitiesRoomProps) => {
  return (
    <div
      className={cn("flex items-center gap-3 text-muted-foreground", className)}
    >
      {amenities?.length > 0 && amenities.map((amenity) => {
        const Icon = AMENITY_ICONS[amenity];
        if (!Icon) {
          return null;
        }

        return (
          <Icon
            key={amenity}
            className="size-4 stroke-[1.5]"
            aria-label={amenity}
          />
        );
      })}
    </div>
  );
}
