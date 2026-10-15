export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

/** Booking summary passed from Mastra lookup → CopilotKit HITL cancel/modify flows. */
export type CancellationBookingSummary = {
  bookingId: string;
  roomId: string;
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  totalPrice: number;
};
