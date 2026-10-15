import { z } from "zod";

import { asNonEmptyString, asPositiveInt } from "./common";
import { asRecord, type JsonValue } from "./json-value";

/**
 * Parsed HITL stay payload used to override LLM tool args in booking flows.
 */
export type ConfirmedStay = {
  bookingId?: string;
  roomId?: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
};

/**
 * Loose zod shape covering confirmed:true branches of
 * ConfirmBookingResult | ConfirmModifyBookingResult | EditModifyBookingResult.
 * Keeps optional bookingId/roomId so one parser covers create + modify HITL.
 */
const confirmedStayPayloadSchema = z.object({
  confirmed: z.literal(true),
  bookingId: z.string().optional(),
  roomId: z.string().optional(),
  checkInDate: z.string().min(1),
  checkOutDate: z.string().min(1),
  guests: z.number().int().positive(),
});

/**
 * Parses a confirmed HITL stay from edit/confirm tool output.
 *
 * @param output - Tool result payload (object or JSON string)
 * @returns Confirmed stay fields, or null when the result is not usable
 */
export const parseConfirmedStay = (
  output: JsonValue | undefined,
): ConfirmedStay | null => {
  const record = asRecord(output);
  if (!record) {
    return null;
  }

  const parsed = confirmedStayPayloadSchema.safeParse({
    confirmed: record.confirmed,
    bookingId: asNonEmptyString(record.bookingId),
    roomId: asNonEmptyString(record.roomId),
    checkInDate: asNonEmptyString(record.checkInDate),
    checkOutDate: asNonEmptyString(record.checkOutDate),
    guests: asPositiveInt(record.guests),
  });

  if (!parsed.success) {
    return null;
  }

  const { bookingId, roomId, checkInDate, checkOutDate, guests } = parsed.data;

  return {
    bookingId,
    roomId,
    checkInDate,
    checkOutDate,
    guests,
  };
};
