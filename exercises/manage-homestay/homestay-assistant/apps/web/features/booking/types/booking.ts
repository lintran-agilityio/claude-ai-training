import type { GetBookingsPurpose } from "@repo/constants";
import type { Room } from "@/features/room/types/room";
import { ToolRendererProps } from "@/features/chatbot/declarative-ui/types";

export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CHECKED_IN = "checked_in",
  CHECKED_OUT = "checked_out",
  CANCELLED = "cancelled",
}

export interface BookingItem {
  id: string;
  userId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  totalPrice: number;
  status: BookingStatus;
}

export interface BookingResponse extends BookingItem {
  room?: Room;
}

export interface BookingDraft {
  roomId: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  guests: number;
}

/** Pre-edit booking stay used to render confirm_modify before → after diffs. */
export type ModifyStaySnapshot = {
  checkInDate: string;
  checkOutDate: string;
  guests: number;
};

/** Room fields the confirm_modify_booking card renders (web Room or model-authored args.room). */
export type ModifyCardRoom = {
  id: string;
  name: string;
  pricePerNight?: number;
};

/** Candidate stay chosen in edit_modify_booking — authoritative for confirm_modify UI. */
export type PendingModifyStay = ModifyStaySnapshot & {
  bookingId: string;
  /** Original booking values from edit_modify_booking args (before the guest edited). */
  original: ModifyStaySnapshot;
};

export type BookingDetails = {
  bookingId: string;
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  guests?: number;
  totalPrice?: number;
};

/**
 * Availability probe attached to a `find_booking_by_id(purpose:"modify")`
 * result on the stated-change path — the app has no `check_room_availability`
 * tool. Dates/guests are the merged stay (current stay + stated overrides).
 */
export type ModifyAvailability = {
  available: boolean;
  guestsWithinCapacity: boolean;
  /** Whether the merged stay's dates alone are free, independent of guest count. */
  datesAvailable: boolean;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
};

export type FindBookingByIdResultBooking = {
  bookingId: string;
  roomId: string;
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  totalPrice?: number;
};

export type FindBookingByIdResult = {
  bookings?: FindBookingByIdResultBooking[];
  bookingId?: string;
  queryName?: string;
  room?: Room;
  reason?: "not_modifiable" | "lookup_failed";
  requestedCheckInDate?: string;
  requestedCheckOutDate?: string;
  requestedGuests?: number;
  /** MODIFY stated-change path only. */
  availability?: ModifyAvailability;
  /** MODIFY stated-change path only — merged stay equals the current stay. */
  stayUnchanged?: boolean;
};

export type FindBookingByIdParameters = {
  purpose?: "cancel" | "modify";
};

export type FindBookingByIdToolProps =
  ToolRendererProps<FindBookingByIdResult> & {
    parameters?: FindBookingByIdParameters;
  };

export type CancelBookingResult = {
  id?: string;
  room?: {
    name?: string;
  };
  status?: string;
};

export type CancelBookingParameters = {
  bookingId?: string;
};

export type CancelBookingToolProps = ToolRendererProps<CancelBookingResult> & {
  parameters?: CancelBookingParameters;
};

export type CreateBookingResult = {
  id?: string;
  roomId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  totalPrice?: number;
  status?: string;
  room?: {
    name?: string;
  };
};

export type CreateBookingParameters = {
  roomId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
};

export type CreateBookingToolProps = ToolRendererProps<CreateBookingResult> & {
  parameters?: CreateBookingParameters;
};

export type UpdateBookingResult = {
  id?: string;
  room?: {
    name?: string;
  };
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  status?: string;
};

export type UpdateBookingParameters = {
  bookingId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guests?: number;
  confirmation?: {
    confirmed: true;
    bookingId: string;
    checkInDate: string;
    checkOutDate: string;
    guests: number;
  };
};

export type UpdateBookingToolProps = ToolRendererProps<UpdateBookingResult> & {
  parameters?: UpdateBookingParameters;
};

export type GetBookingsResult = {
  bookings?: BookingResponse[];
  /**
   * Echoed from get_bookings args. "resolve" means cancel/modify/change-room
   * resolution forced this fetch — not a guest-facing VIEW/LIST call.
   * MyBookingsNotice suppresses itself in this case so only the HITL that
   * follows (confirm dialog or picker) renders.
   */
  purpose?: GetBookingsPurpose;
  /** Echoed from get_bookings args when the upcoming check-ins window was fetched. */
  upcomingCheckIns?: boolean;
};

export type GetBookingsParameters = {
  purpose?: GetBookingsResult["purpose"];
  /** Set when the agent fetched the upcoming check-ins window. */
  upcomingCheckIns?: boolean;
};

export type GetBookingsToolProps = ToolRendererProps<GetBookingsResult> & {
  parameters?: GetBookingsParameters;
};

export type UpcomingPeriod = "today" | "tomorrow" | "next3days";

export interface UpcomingBookingItem {
  id: string;
  roomName: string;
  guests: number;
  guestName: string;
  date: string;
  /** Backend status, uppercase (PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT). */
  status: string;
}

export interface UpcomingBookingsResponse {
  period: UpcomingPeriod;
  from: string;
  to: string;
  checkIns: UpcomingBookingItem[];
  checkOuts: UpcomingBookingItem[];
}
