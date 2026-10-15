"use client";

import { useEffect, useState } from "react";
import Image, { type StaticImageData } from "next/image";

import {
  RoomBookingPricePerNight,
  RoomBookingSummaryHeader,
} from "@/features/room/components";
import { FALLBACK_ROOM_IMAGE, resolveRoomImage } from "@/features/room/utils";

type RoomBookingPreviewCardProps = {
  name: string;
  imageUrl?: string | null;
  capacity: number;
  pricePerNight: number;
  label?: string;
};

export const RoomBookingPreviewCard = ({
  name,
  imageUrl,
  capacity,
  pricePerNight,
  label = "Your booking",
}: RoomBookingPreviewCardProps) => {
  const [resolvedImage, setResolvedImage] = useState<string | StaticImageData>(
    () => resolveRoomImage(imageUrl),
  );

  useEffect(() => {
    setResolvedImage(resolveRoomImage(imageUrl));
  }, [imageUrl]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="relative aspect-[16/10] bg-muted">
        <Image
          src={resolvedImage}
          alt={name}
          width={800}
          height={500}
          sizes="(max-width: 768px) 100vw, 512px"
          className="size-full object-cover"
          onError={() => setResolvedImage(FALLBACK_ROOM_IMAGE)}
        />
      </div>
      <div className="space-y-2 p-4">
        <RoomBookingSummaryHeader
          label={label}
          name={name}
          capacityText={`up to ${capacity}`}
          nameClassName="text-base font-medium"
          usersIconClassName="size-3.5"
        />
        <RoomBookingPricePerNight pricePerNight={pricePerNight} size="sm" />
      </div>
    </div>
  );
};
