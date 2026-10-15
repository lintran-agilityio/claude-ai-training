"use client";

import { AlertTriangle } from "lucide-react";
import { useCallback } from "react";

import {
  countNightOfDates,
  formatShortDateForDisplay,
  guestLabel,
  nightLabel,
} from "@repo/utils";
import type { BookingUnavailableReason } from "@repo/schemas";

import { Button } from "@/components/ui/button";
import { useSendAgentMessage } from "@/features/chatbot/hooks";
import { useRequestRoomBookingForm } from "@/features/room/hooks";

export type BookingUnavailableProps = {
  /** Powers the "adjust this request" suggested actions — absent (e.g. a
   * MODIFY lookup that never resolved a room) just hides them. */
  roomId?: string;
  roomName: string;
  /**
   * Optional on purpose. This card can be shown before the guest has given any
   * date (a capacity problem is known the moment the room and party size are),
   * and it previously required both dates — which meant rendering whatever the
   * caller had, including a date the guest never chose. Absent dates now omit
   * the row instead of printing a fabricated stay.
   */
  checkInDate?: string;
  checkOutDate?: string;
  /** Stated stay length, shown when the dates themselves are not yet known. */
  nights?: number;
  guests: number;
  reason: BookingUnavailableReason;
  capacity?: number;
};

const CARD_TITLE = "Room Unavailable";

const describeReason = (
  reason: BookingUnavailableReason,
  roomName: string,
  guests: number,
  capacity: number | undefined,
): string => {
  if (reason === "capacity_exceeded") {
    const maxLabel = capacity != null ? `up to ${guestLabel(capacity)}` : "fewer guests";
    return `${roomName} accommodates ${maxLabel}, but your request is for ${guestLabel(guests)}.`;
  }

  if (reason === "capacity_and_dates_unavailable") {
    return `${roomName} cannot accommodate your current booking request.`;
  }

  return `${roomName} is not available for your selected dates.`;
};

/** Adjust-request button label(s) — same "reopen the Booking Form" action, worded to the actual problem. */
const resolveAdjustLabels = (
  reason: BookingUnavailableReason,
  hasStay: boolean,
): string[] => {
  if (!hasStay) {
    // No check-in date at all: capacity is knowable, but so is the fix for
    // "which field is missing" — the plan calls out both explicitly rather
    // than one combined button.
    return ["Change Guest Count", "Provide Check-in Date"];
  }

  if (reason === "capacity_and_dates_unavailable") {
    return ["Change Dates or Guests"];
  }

  return reason === "capacity_exceeded" ? ["Change Guest Count"] : ["Change Dates"];
};

export const BookingUnavailable = ({
  roomId,
  roomName,
  checkInDate,
  checkOutDate,
  nights,
  guests,
  reason,
  capacity,
}: BookingUnavailableProps) => {
  const description = describeReason(reason, roomName, guests, capacity);
  const hasStay = Boolean(checkInDate && checkOutDate);
  const displayNights = hasStay
    ? countNightOfDates(checkInDate as string, checkOutDate as string)
    : nights;

  const onSendError = useCallback((error: unknown) => {
    console.error("Failed to search rooms from BookingUnavailable", error);
  }, []);
  const { sendMessage, isSending: isSearching } = useSendAgentMessage({
    onError: onSendError,
  });
  const requestRoomBookingForm = useRequestRoomBookingForm();

  const handleFindRooms = () => {
    const message = hasStay
      ? `Find available rooms for ${guestLabel(guests)} from ${formatShortDateForDisplay(checkInDate as string)} to ${formatShortDateForDisplay(checkOutDate as string)}.`
      : `Find rooms for ${guestLabel(guests)}.`;
    sendMessage(message);
  };

  const handleAdjustRequest = () => {
    if (!roomId) return;
    requestRoomBookingForm({ roomId, roomName, openOnPage: false });
  };

  const primaryLabel = hasStay ? "Find Available Rooms" : `Find Rooms for ${guestLabel(guests)}`;
  const adjustLabels = resolveAdjustLabels(reason, hasStay);

  return (
    <div className="p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
          <AlertTriangle
            className="size-4 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {CARD_TITLE}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>

          <dl className="mt-2 space-y-0.5 border-t border-border pt-2 text-xs text-foreground">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Room</dt>
              <dd className="truncate text-right">{roomName}</dd>
            </div>
            {hasStay ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Dates</dt>
                <dd className="text-right">
                  {formatShortDateForDisplay(checkInDate as string)} →{" "}
                  {formatShortDateForDisplay(checkOutDate as string)}
                </dd>
              </div>
            ) : (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Check-in date</dt>
                <dd className="text-right">Not specified</dd>
              </div>
            )}
            {displayNights ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Stay</dt>
                <dd className="text-right">{nightLabel(displayNights)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Guests</dt>
              <dd className="text-right">{guests}</dd>
            </div>
          </dl>

          {reason === "capacity_and_dates_unavailable" ? (
            <div className="mt-2 space-y-1 border-t border-border pt-2">
              <p className="text-xs font-medium text-foreground">Why it&apos;s unavailable</p>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {capacity != null ? (
                  <li>Maximum capacity: {guestLabel(capacity)}</li>
                ) : null}
                <li>Requested guests: {guestLabel(guests)}</li>
                <li>Room is unavailable for the selected dates</li>
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={isSearching}
              onClick={handleFindRooms}
            >
              {primaryLabel}
            </Button>
            {roomId
              ? adjustLabels.map((label) => (
                  <Button
                    key={label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={handleAdjustRequest}
                  >
                    {label}
                  </Button>
                ))
              : null}
          </div>
        </div>
      </div>
    </div>
  );
};
