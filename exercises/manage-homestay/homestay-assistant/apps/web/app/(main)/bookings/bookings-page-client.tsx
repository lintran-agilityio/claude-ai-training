"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

import { PREFIX_URL } from "@repo/types";
import { PageHeader } from "@/components/common";
import { BookingFilterBar, BookingList } from "@/features/booking/components";
import { useDebouncedValue } from "@/features/booking/hooks";
import { getMyBookings } from "@/features/booking/services";
import type { BookingFilters } from "@/features/booking/types/booking";

const MY_BOOKINGS_TITLE = "Your reservations";

type BookingsPageClientProps = {
  userId: string;
};

export const BookingsPageClient = ({ userId }: BookingsPageClientProps) => {
  const { isLoaded, isSignedIn } = useAuth();
  const [filters, setFilters] = useState<BookingFilters>({});
  const debouncedRoomName = useDebouncedValue(filters.roomName);
  const activeFilters: BookingFilters = {
    ...filters,
    // Only the typing path is debounced; clearing the field applies at once so
    // a stale name is never sent with the other (immediate) filters.
    roomName: filters.roomName?.trim()
      ? debouncedRoomName?.trim() || undefined
      : undefined,
  };

  const {
    data: bookings = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "bookings",
      userId,
      activeFilters.roomName,
      activeFilters.checkInDate,
      activeFilters.status,
    ],
    queryFn: ({ signal }) =>
      getMyBookings({ via: PREFIX_URL.WEB, signal, filters: activeFilters }),
    enabled: Boolean(isLoaded && isSignedIn && userId),
    retry: false,
  });

  return (
    <>
      <PageHeader
        title="MY BOOKINGS"
        description="Review, modify, or cancel your upcoming stays."
      />
      <BookingFilterBar
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters({})}
      />
      <BookingList
        bookings={bookings}
        title={MY_BOOKINGS_TITLE}
        className="mt-8"
        isLoading={isLoading}
        error={error ?? undefined}
        onRetry={() => void refetch()}
      />
    </>
  );
};
