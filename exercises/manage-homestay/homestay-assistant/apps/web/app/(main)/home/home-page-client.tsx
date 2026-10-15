"use client";

import { useLayoutEffect } from "react";
import { useUser } from "@clerk/nextjs";

import { PageHeader } from "@/components/common";
import { RoomGrid } from "@/features/room/components";
import { useRoomStore } from "@/features/room/stores/room-store";
import type { Room } from "@/features/room/types/room";

type HomePageClientProps = {
  initialRooms: Room[];
};

const HomePageContent = ({ initialRooms }: HomePageClientProps) => {
  useLayoutEffect(() => {
    if (useRoomStore.getState().rooms.length === 0) {
      useRoomStore.getState().updateRoomList(initialRooms);
    }
  }, [initialRooms]);

  return (
    <>
      <PageHeader
        title="Rooms"
        description="Discover our handpicked homestays, each with its own story."
      />
      <RoomGrid className="mt-8" initialRooms={initialRooms} />
    </>
  );
};

const HomePageClient = ({ initialRooms }: HomePageClientProps) => {
  const { isLoaded, user } = useUser();

  if (!isLoaded || !user) {
    return null;
  }

  return <HomePageContent initialRooms={initialRooms} />;
};

export default HomePageClient;
