"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

import { PREFIX_URL } from "@repo/types";
import { PageHeader } from "@/components/common";
import { BookingList } from "@/features/booking/components";
import { getMyBookings } from "@/features/booking/services";

const MY_BOOKINGS_TITLE = "Your reservations";

type BookingsPageClientProps = {
  userId: string;
};

export const BookingsPageClient = ({ userId }: BookingsPageClientProps) => {
  const { isLoaded, isSignedIn } = useAuth();
  const {
    data: bookings = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bookings", userId],
    queryFn: ({ signal }) =>
      getMyBookings({ via: PREFIX_URL.WEB, signal }),
    enabled: Boolean(isLoaded && isSignedIn && userId),
    retry: false,
  });

  return (
    <>
      <PageHeader
        title="MY BOOKINGS"
        description="Review, modify, or cancel your upcoming stays."
      />
      <BookingList
        bookings={bookings}
        title={MY_BOOKINGS_TITLE}
        className="mt-8"
        isLoading={isLoading}
        error={error ?? undefined}
      />
    </>
  );
};
