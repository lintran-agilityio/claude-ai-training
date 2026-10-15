import { z } from "zod";
import { roomSchema } from "@repo/schemas";

export const getRoomDetailOutputSchema = z.object({
  room: roomSchema.extend({
    /**
     * Booking Form prefill hint — set only when a prior dated search already
     * established these values in this conversation. The guest can still
     * edit them; this is a default, not a commitment.
     */
    checkInDate: z.string().optional(),
    checkOutDate: z.string().optional(),
    /** Same prefill hint, for guest count stated directly in the BOOK message. */
    guests: z.number().optional(),
    /**
     * Stated stay LENGTH in nights. Unlike the date hints above this is set
     * even when no check-in is known — the form then opens with empty dates
     * and uses this to resolve check-out once the guest picks a check-in.
     */
    nights: z.number().optional(),
  }),
});

export type GetRoomDetailOutput = z.infer<typeof getRoomDetailOutputSchema>;
