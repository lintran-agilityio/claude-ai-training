"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronRight, Images } from "lucide-react";

import { cn } from "@repo/utils";
import { FALLBACK_ROOM_IMAGE, resolveRoomImage } from "@/features/room/utils";
import { DEFAULT_ROOM_GALLERY_IMAGES, ROOM_GALLERY_IMAGES } from "@/mocks/room";

type RoomImageGalleryProps = {
  roomId: string;
  imageUrl: string;
  name: string;
  level: number;
  levelColor: string;
  imageUrls?: string[];
};

export const RoomImageGallery = ({
  roomId,
  imageUrl,
  name,
  level,
  levelColor,
  imageUrls,
}: RoomImageGalleryProps) => {
  const images = useMemo(() => {
    const gallery = imageUrls?.length
      ? imageUrls
      : (ROOM_GALLERY_IMAGES[roomId] ?? DEFAULT_ROOM_GALLERY_IMAGES);

    return gallery.includes(imageUrl) ? gallery : [imageUrl, ...gallery];
  }, [imageUrl, imageUrls, roomId]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(
    () => new Set(),
  );
  const [thumbStart, setThumbStart] = useState(0);
  const activeImage = images[activeIndex] ?? imageUrl;
  const resolveImage = (src: string) =>
    failedImages.has(src) ? FALLBACK_ROOM_IMAGE : resolveRoomImage(src);

  const markImageFailed = (src: string) => {
    setFailedImages((current) => {
      if (current.has(src)) {
        return current;
      }

      const next = new Set(current);
      next.add(src);
      return next;
    });
  };

  const visibleThumbCount = 5;
  const canScrollThumbs = images.length > visibleThumbCount;
  const visibleThumbs = images.slice(
    thumbStart,
    thumbStart + visibleThumbCount,
  );

  const handleNextThumbs = () => {
    if (!canScrollThumbs) {
      return;
    }

    setThumbStart((current) =>
      Math.min(current + 1, Math.max(0, images.length - visibleThumbCount)),
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[2/1] overflow-hidden rounded-xl bg-muted">
        <Image
          src={resolveImage(activeImage)}
          alt={`${name} — photo ${activeIndex + 1}`}
          width={1200}
          height={600}
          sizes="(max-width: 1024px) 80vw, 50vw"
          onError={() => {
            markImageFailed(activeImage);
          }}
          loading="lazy"
          className="size-full object-cover transition-opacity duration-300"
        />

        <span
          className="absolute left-4 top-4 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
          style={{ backgroundColor: levelColor || "oklch(0.38 0.055 162)" }}
        >
          Level {level}
        </span>

        <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-md bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <Images className="size-3.5 text-gold" />
          {activeIndex + 1} / {images.length}
        </span>
      </div>

      {images.length > 1 ? (
        <div className="flex items-center gap-2">
          <div className="app-scrollbar flex flex-1 gap-2 overflow-x-auto pb-1">
            {visibleThumbs.map((url, offset) => {
              const index = thumbStart + offset;

              return (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  aria-label={`View image ${index + 1}`}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "relative aspect-[4/3] w-[4.75rem] shrink-0 overflow-hidden rounded-lg border-2 transition-colors cursor-pointer sm:w-24",
                    index === activeIndex
                      ? "border-gold"
                      : "border-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  <Image
                    src={resolveImage(url)}
                    alt={`${name} thumbnail ${index + 1}`}
                    width={96}
                    height={72}
                    sizes="96px"
                    className="size-full object-cover"
                    loading="lazy"
                    onError={() => {
                      markImageFailed(url);
                    }}
                  />
                </button>
              );
            })}
          </div>

          {canScrollThumbs && thumbStart + visibleThumbCount < images.length ? (
            <button
              type="button"
              aria-label="Show more thumbnails"
              onClick={handleNextThumbs}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
