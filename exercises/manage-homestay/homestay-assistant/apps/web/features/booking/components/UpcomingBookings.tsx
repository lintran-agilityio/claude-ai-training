"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { PREFIX_URL } from "@repo/types";
import { getUpcomingBookings } from "@/features/booking/services";
import {
  UPCOMING_BOOKINGS_COPY as COPY,
  UPCOMING_PERIODS,
  UPCOMING_PERIOD_PHRASE,
} from "@/features/booking/constants";
import type {
  UpcomingBookingItem,
  UpcomingPeriod,
} from "@/features/booking/types/booking";

type UpcomingListProps = {
  title: string;
  items: UpcomingBookingItem[];
  emptyMessage: string;
};

const UpcomingList = ({ title, items, emptyMessage }: UpcomingListProps) => (
  <section className="flex-1">
    <h3 className="mb-2 font-medium">
      {title} ({items.length})
    </h3>
    {items.length === 0 ? (
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    ) : (
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border p-3 text-sm">
            {item.roomName} · {item.guests}{" "}
            {item.guests === 1 ? "guest" : "guests"} · {item.guestName}
            <span className="block text-xs text-muted-foreground">
              {item.date} · {item.status.replace("_", " ").toLowerCase()}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

type UpcomingBookingsProps = {
  userId: string;
  className?: string;
};

export const UpcomingBookings = ({
  userId,
  className,
}: UpcomingBookingsProps) => {
  const { isLoaded, isSignedIn } = useAuth();
  const [period, setPeriod] = useState<UpcomingPeriod>("today");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["bookings", "upcoming", userId, period],
    queryFn: ({ signal }) =>
      getUpcomingBookings({ period, via: PREFIX_URL.WEB, signal }),
    enabled: Boolean(isLoaded && isSignedIn && userId),
    retry: false,
  });

  const phrase = UPCOMING_PERIOD_PHRASE[period];

  return (
    <section className={className}>
      <h2 className="mb-3 text-lg font-semibold">{COPY.title}</h2>
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Period"
      >
        {UPCOMING_PERIODS.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={value === period ? "default" : "outline"}
            aria-pressed={value === period}
            onClick={() => setPeriod(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {COPY.loading}
        </p>
      ) : error ? (
        <div className="flex items-center gap-3" role="alert">
          <p className="text-destructive">{COPY.error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => refetch()}
          >
            {COPY.retry}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row">
          <UpcomingList
            title={COPY.checkIns}
            items={data?.checkIns ?? []}
            emptyMessage={`${COPY.emptyCheckIns} ${phrase}`}
          />
          <UpcomingList
            title={COPY.checkOuts}
            items={data?.checkOuts ?? []}
            emptyMessage={`${COPY.emptyCheckOuts} ${phrase}`}
          />
        </div>
      )}
    </section>
  );
};
