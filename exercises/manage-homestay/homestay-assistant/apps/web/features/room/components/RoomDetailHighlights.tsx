import {
  Coffee,
  Layers,
  Mic,
  Monitor,
  Phone,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import {
  AMENITY_HIGHLIGHTS,
  type AmenityHighlight,
} from "@/constants";
import { cn } from "@repo/utils";
import type { Amenity } from "@/features/room/types/room";

const AMENITY_ICONS = {
  monitor: Monitor,
  coffee: Coffee,
  mic: Mic,
  wifi: Wifi,
  video: Monitor,
  whiteboard: Monitor,
  phone: Phone,
} satisfies Partial<Record<Amenity, LucideIcon>>;

type RoomDetailQuickStatsProps = {
  capacity: number;
  level: number;
  className?: string;
};

export const RoomDetailQuickStats = ({
  capacity,
  level,
  className,
}: RoomDetailQuickStatsProps) => {
  const stats = [
    {
      icon: Users,
      label: `${capacity} Guest${capacity === 1 ? "" : "s"}`,
    },
    {
      icon: Layers,
      label: `Level ${level}`,
    },
  ].slice(0, 5);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground",
        className,
      )}
    >
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div key={stat.label} className="inline-flex items-center gap-2">
            <Icon className="size-4 text-gold" />
            <span>{stat.label}</span>
          </div>
        );
      })}
    </div>
  );
};

type AmenityHighlightItem = AmenityHighlight & {
  amenity: Amenity;
  Icon: LucideIcon;
};

type RoomDetailAmenityHighlightsProps = {
  amenities: Amenity[];
  className?: string;
};

export const RoomDetailAmenityHighlights = ({
  amenities,
  className,
}: RoomDetailAmenityHighlightsProps) => {
  const highlights: AmenityHighlightItem[] = amenities.flatMap((amenity) => {
    const meta = AMENITY_HIGHLIGHTS[amenity];
    const Icon = AMENITY_ICONS[amenity];
    if (!meta || !Icon) {
      return [];
    }

    return [{ amenity, ...meta, Icon }];
  }).slice(0, 4);

  if (highlights.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2",
        className,
      )}
    >
      {highlights.map(({ amenity, title, description, Icon }) => (
        <div key={amenity} className="flex items-start gap-3">
          <Icon className="mt-0.5 size-4 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
