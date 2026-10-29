import type { RoomAvailabilityOverview } from "@repo/schemas";
import type { BookingStatus } from "@repo/types";
import type { FindRoomPurpose, FindRoomSort } from "@repo/constants";
import type { ToolRendererProps } from "@/features/chatbot/declarative-ui/types";

export type Amenity =
  | "monitor"
  | "coffee"
  | "mic"
  | "wifi"
  | "video"
  | "whiteboard"
  | "phone";

export type Room = {
  id: string;
  name: string;
  level: number;
  levelColor: string;
  capacity: number;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  availableSlots: number;
  pricePerNight?: number;
  amenities: Amenity[];
  bookingStatus?: BookingStatus;
  checkInDate?: string;
  checkOutDate?: string;
  /** Booking Form prefill hint — guest count stated directly in the BOOK message. */
  guests?: number;
  /**
   * Booking Form prefill hint — stay LENGTH in nights stated in the BOOK
   * message. Present even when no dates are, so picking a check-in resolves
   * check-out to check-in + nights instead of a single night.
   */
  nights?: number;
  available?: boolean;
};

/**
 * Availability probe attached to a `book_resolve` result with exactly one
 * match, present once the guest count is known — the CREATE flow's
 * replacement for a `check_room_availability` call. Absent → the Booking Form
 * opens and runs its own check.
 *
 * `checkInDate`/`checkOutDate`/`datesAvailable` are only set once a check-in
 * date is ALSO known and the real `/bookings/availability` probe ran; absent
 * means only guest capacity was evaluated (party size vs room capacity, no
 * date needed) — see `resolveBookingUnavailableReason`.
 */
export type FindRoomAvailability = {
  available: boolean;
  guestsWithinCapacity: boolean;
  datesAvailable?: boolean;
  checkInDate?: string;
  checkOutDate?: string;
  guests: number;
};

export type FindRoomResult = {
  rooms?: Room[];
  name?: string;
  date?: string;
  guests?: number;
  /** Echoed from find_room args — stay LENGTH in nights the guest stated. */
  nights?: number;
  level?: number;
  /** Echoed from find_room args — ranking order actually applied to `rooms`; FindRoomNotice re-applies it defensively via sortRooms(). */
  sortBy?: FindRoomSort;
  /** Echoed from find_room args — price ceiling actually applied to `rooms` (VND). Not yet rendered in UI. */
  maxPrice?: number;
  /** Echoed from find_room args — skip Room List when book_resolve + exactly 1 room, or always for resolve. */
  purpose?: FindRoomPurpose;
  /** book_resolve + exactly 1 match only. */
  availability?: FindRoomAvailability;
};

export type FindRoomToolProps = ToolRendererProps<FindRoomResult> & {
  /** Streaming tool args — used to skip Room List skeleton on book_resolve/resolve. */
  parameters?: {
    purpose?: FindRoomResult["purpose"];
  };
};

export type GetRoomByIdResult = {
  room?: Room | null;
};

export type GetRoomByIdToolProps = ToolRendererProps<GetRoomByIdResult>;
export type RoomAvailabilityToolProps =
  ToolRendererProps<RoomAvailabilityOverview>;
