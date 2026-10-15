"use client";

import { useEffect, useRef, useState } from "react";

import { isCheckOutAfterCheckIn } from "@repo/utils";

import { checkRoomAvailability } from "@/features/booking/services/check-room-availability";
import {
  resolveBookingUnavailableReason,
  type BookingUnavailableReason,
} from "@repo/schemas";

type UseRoomAvailabilityArgs = {
  roomId: string | null | undefined;
  checkInDate: string | null;
  checkOutDate: string | null;
  guests: number;
  /**
   * MODIFY only — the booking being edited, excluded from overlap detection so
   * its own dates never read as "taken". Omit for a new stay.
   */
  excludeBookingId?: string | null;
  /** Skip the network check (e.g. read-only / locked forms). */
  enabled?: boolean;
};

export type RoomAvailabilityState = {
  isChecking: boolean;
  /** `null` until the first result for the CURRENT stay lands — never a stale value. */
  isAvailable: boolean | null;
  guestsWithinCapacity: boolean | null;
  reason: BookingUnavailableReason | null;
};

type CachedResult = Omit<RoomAvailabilityState, "isChecking">;

const IDLE: RoomAvailabilityState = {
  isChecking: false,
  isAvailable: null,
  guestsWithinCapacity: null,
  reason: null,
};

const DEBOUNCE_MS = 300;

/**
 * Client-side availability check for the booking forms — the app has no
 * `check_room_availability` tool. Used by the CREATE Booking Form (`RoomDetail`)
 * and the MODIFY edit form (`EditModifyBookingModal`, passing `excludeBookingId`
 * so the booking's own dates don't read as taken). Hits the same
 * `/api/bookings/availability` route the agent probes.
 *
 * Deliberately non-blocking for date selection:
 *   - each unique stay is checked at most once (cached for the form's lifetime)
 *   - a stay change resets to `isAvailable: null` immediately, so the action
 *     button and any error text clear the instant the guest picks a new date —
 *     they only reappear if the fresh check confirms that date is taken too
 *   - `create_booking` / `update_booking` still re-check server-side as the
 *     final gate
 */
export const useRoomAvailability = ({
  roomId,
  checkInDate,
  checkOutDate,
  guests,
  excludeBookingId,
  enabled = true,
}: UseRoomAvailabilityArgs): RoomAvailabilityState => {
  const [state, setState] = useState<RoomAvailabilityState>(IDLE);
  const cacheRef = useRef<Map<string, CachedResult>>(new Map());

  const validRange =
    Boolean(checkInDate) &&
    Boolean(checkOutDate) &&
    isCheckOutAfterCheckIn(checkInDate as string, checkOutDate as string);
  const key =
    enabled && roomId && validRange && guests >= 1
      ? `${roomId}|${checkInDate}|${checkOutDate}|${guests}|${excludeBookingId ?? ""}`
      : null;

  useEffect(() => {
    if (!key) {
      setState(IDLE);
      return;
    }

    const cached = cacheRef.current.get(key);
    if (cached) {
      setState({ isChecking: false, ...cached });
      return;
    }

    // Reset to "unknown" (not a stale false) so the form is usable while we check.
    setState({
      isChecking: true,
      isAvailable: null,
      guestsWithinCapacity: null,
      reason: null,
    });

    let cancelled = false;
    const timer = setTimeout(() => {
      checkRoomAvailability({
        roomId: roomId as string,
        checkInDate: checkInDate as string,
        checkOutDate: checkOutDate as string,
        guests,
        ...(excludeBookingId ? { excludeBookingId } : {}),
      })
        .then((result) => {
          if (cancelled) return;
          const guestsWithinCapacity = result.guestsWithinCapacity !== false;
          const isAvailable = result.available !== false;
          const entry: CachedResult = {
            isAvailable,
            guestsWithinCapacity,
            reason: resolveBookingUnavailableReason({
              guestsWithinCapacity,
              datesAvailable: result.datesAvailable,
            }),
          };
          cacheRef.current.set(key, entry);
          setState({ isChecking: false, ...entry });
        })
        .catch(() => {
          if (cancelled) return;
          // Network failure → don't block the guest; POST /bookings is the
          // authoritative gate and rejects a genuinely taken date.
          setState(IDLE);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, roomId, checkInDate, checkOutDate, guests, excludeBookingId]);

  return state;
};
