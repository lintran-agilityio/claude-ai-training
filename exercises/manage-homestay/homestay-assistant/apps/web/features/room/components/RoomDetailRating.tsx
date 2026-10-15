import { Star } from "lucide-react";

import {
  ROOM_DETAIL_STATIC_RATING,
  ROOM_DETAIL_STATIC_REVIEW_COUNT,
} from "@/constants";

export const RoomDetailRating = () => {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Star className="size-4 fill-gold text-gold" />
      <span className="font-semibold text-foreground">
        {ROOM_DETAIL_STATIC_RATING.toFixed(1)}
      </span>
      <span className="font-medium text-muted-foreground">
        ({ROOM_DETAIL_STATIC_REVIEW_COUNT} reviews)
      </span>
    </div>
  );
};
