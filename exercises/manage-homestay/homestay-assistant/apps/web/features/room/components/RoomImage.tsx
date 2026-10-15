"use client";

import { cn } from "@repo/utils";
import Image, { type StaticImageData } from "next/image";
import { useState } from "react";
import { Users } from "lucide-react";

import { FALLBACK_ROOM_IMAGE, resolveRoomImage } from "@/features/room/utils";

type RoomImageProps = {
  imageUrl: string;
  name: string;
  level: number;
  levelColor: string;
  compact?: boolean;
  capacity: number;
};

export function RoomImage({
  imageUrl,
  name,
  level,
  levelColor,
  compact = false,
  capacity,
}: RoomImageProps) {
  const [url, setUrl] = useState<string | StaticImageData>(
    resolveRoomImage(imageUrl),
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        compact ? "aspect-[16/10]" : "aspect-[4/3]",
      )}
    >
      <Image
        src={url}
        alt={name}
        width={800}
        height={compact ? 500 : 600}
        sizes={
          compact
            ? "(max-width: 768px) 100vw, 384px"
            : "(max-width: 768px) 100vw, 300px"
        }
        onError={() => {
          setUrl(FALLBACK_ROOM_IMAGE);
        }}
        priority
        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/60 via-black/15 to-transparent p-3">
        <div className="flex w-full items-center justify-between gap-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">
            <span
              className="h-3 w-1 rounded-full"
              style={{ backgroundColor: levelColor }}
            />
            Level {level}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-foreground/70 px-2 py-1 text-xs font-medium text-background">
            <Users className="size-3.5" />
            {capacity}
          </span>
        </div>
      </div>
    </div>
  );
}
