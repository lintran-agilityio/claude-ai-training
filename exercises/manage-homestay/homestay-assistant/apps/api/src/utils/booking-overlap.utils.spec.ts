import { BookingStatus } from '../types/enum';
import {
  ACTIVE_BOOKING_STATUSES,
  OCCUPYING_BOOKING_STATUSES,
} from './booking-overlap.utils';

describe('booking status lists', () => {
  it('treats a CHECKED_IN booking as occupying the room', () => {
    expect(OCCUPYING_BOOKING_STATUSES).toContain(BookingStatus.CHECKED_IN);
  });

  it.each([
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.CHECKED_IN,
  ])('occupies the room when %s', (status) => {
    expect(OCCUPYING_BOOKING_STATUSES).toContain(status);
  });

  it.each([BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED])(
    'does not occupy the room when %s',
    (status) => {
      expect(OCCUPYING_BOOKING_STATUSES).not.toContain(status);
    },
  );

  it('keeps CHECKED_IN out of the active (upcoming) statuses', () => {
    expect(ACTIVE_BOOKING_STATUSES).not.toContain(BookingStatus.CHECKED_IN);
  });
});
