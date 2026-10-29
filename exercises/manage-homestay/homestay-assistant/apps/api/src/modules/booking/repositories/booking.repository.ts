import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { extractRoomNameQuery } from '@repo/utils';
import {
  toDateKey,
  startOfDay,
  ACTIVE_BOOKING_STATUSES,
  OCCUPYING_BOOKING_STATUSES,
} from '@/utils';
import { ListBookingsQueryDto } from '@/modules/booking/dto/list-bookings-query.dto';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';

@Injectable()
export class BookingRepository {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
  ) {}

  async findAll(
    filters: ListBookingsQueryDto & { userId: string },
  ): Promise<BookingEntity[]> {
    // checkOutDate is a date-only column — compare against today's date key
    // (not a full timestamp) so a stay checking out today still counts as
    // active for the whole checkout day, matching the agent's isActiveBooking.
    const today = toDateKey(startOfDay(new Date()));

    const query = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room', 'room')
      // Only the guest's name is needed; selecting the whole row would load
      // the password hash and other columns for every booking.
      .leftJoin('booking.user', 'user')
      .addSelect(['user.id', 'user.name'])
      .where('booking.userId = :userId', { userId: filters.userId })
      // Secondary tie-break on id — checkInDate alone is not unique, so
      // repeated identical requests could otherwise return rows in a
      // different order (Postgres does not guarantee stable order for ties).
      .orderBy('booking.checkInDate', 'ASC')
      .addOrderBy('booking.id', 'ASC');

    // Default is active bookings only; includeHistory lifts both limits so the
    // host search can reach cancelled and already-checked-out bookings.
    if (!filters.includeHistory) {
      query
        .andWhere('booking.cancelledAt IS NULL')
        .andWhere('booking.checkOutDate >= :today', { today });
    }

    if (filters.roomId) {
      query.andWhere('booking.roomId = :roomId', { roomId: filters.roomId });
    }

    if (filters.roomName?.trim()) {
      // Guests often say a generic noun around the name ("Moonlight room",
      // "the Loft room") rather than the room's exact name ("Moonlight
      // Loft") — a raw substring match on the untouched phrase then finds
      // nothing. Strip that filler first and require each remaining
      // significant word to appear in the name. A phrase that is filler
      // only ("my room") names no specific room, so no filter is applied
      // instead of one that would match nothing and hide every booking.
      const roomNameTokens = extractRoomNameQuery(filters.roomName)
        .split(' ')
        .filter(Boolean);

      roomNameTokens.forEach((token, index) => {
        query.andWhere(`LOWER(room.name) LIKE LOWER(:roomNameToken${index})`, {
          [`roomNameToken${index}`]: `%${token}%`,
        });
      });
    }

    if (filters.status) {
      query.andWhere('booking.status = :status', { status: filters.status });
    }

    // Exact check-in day (host search); independent of status.
    if (filters.checkInDate) {
      query.andWhere('booking.checkInDate = :checkInDate', {
        checkInDate: filters.checkInDate,
      });
    }

    // Stay covers onDate: checkIn <= onDate AND checkOut > onDate (exclusive checkout).
    if (filters.onDate) {
      query
        .andWhere('booking.checkInDate <= :onDate', { onDate: filters.onDate })
        .andWhere('booking.checkOutDate > :onDate', { onDate: filters.onDate });
    }

    // Stay overlaps [dateFrom, dateTo): same convention as onDate, generalized
    // to a range — e.g. a stated "this weekend" cancel/modify disambiguation
    // (see find_bookings). Both must be present to apply.
    if (filters.dateFrom && filters.dateTo) {
      query
        .andWhere('booking.checkInDate < :dateTo', { dateTo: filters.dateTo })
        .andWhere('booking.checkOutDate > :dateFrom', {
          dateFrom: filters.dateFrom,
        });
    }

    // Check-in falls in [checkInFrom, checkInTo) and the guest has not checked
    // in yet - drives the "upcoming check-ins" summary. Both must be present.
    if (filters.checkInFrom && filters.checkInTo) {
      query
        .andWhere('booking.checkInDate >= :checkInFrom', {
          checkInFrom: filters.checkInFrom,
        })
        .andWhere('booking.checkInDate < :checkInTo', {
          checkInTo: filters.checkInTo,
        })
        .andWhere('booking.status IN (:...upcomingStatuses)', {
          upcomingStatuses: ACTIVE_BOOKING_STATUSES,
        });
    }

    return query.getMany();
  }

  async findById(id: string): Promise<BookingEntity | null> {
    return this.bookingRepository.findOne({
      where: { id },
      relations: { room: true },
    });
  }

  async save(booking: Partial<BookingEntity>): Promise<BookingEntity> {
    return this.bookingRepository.save(booking);
  }

  async hasOverlappingBooking(
    roomId: string,
    checkInDate: Date,
    checkOutDate: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const query = this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.roomId = :roomId', { roomId })
      .andWhere('booking.status IN (:...activeStatuses)', {
        activeStatuses: OCCUPYING_BOOKING_STATUSES,
      })
      .andWhere('booking.checkInDate < :checkOutDate', {
        checkOutDate: toDateKey(checkOutDate),
      })
      .andWhere('booking.checkOutDate > :checkInDate', {
        checkInDate: toDateKey(checkInDate),
      });

    if (excludeBookingId) {
      query.andWhere('booking.id != :excludeBookingId', { excludeBookingId });
    }

    const overlapCount = await query.getCount();
    return overlapCount > 0;
  }
}
