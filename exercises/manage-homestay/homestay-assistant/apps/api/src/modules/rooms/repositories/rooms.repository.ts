import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FIND_ROOM_SORT, type FindRoomSort } from '@repo/constants';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_OVERLAP_JOIN_CONDITION,
} from '@/utils';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import { RoomEntity } from '@/modules/rooms/entities/room.entity';

export type RoomRankingOptions = {
  sortBy?: FindRoomSort;
  maxPrice?: number;
};

@Injectable()
export class RoomsRepository {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
  ) {}

  /**
   * Applies `maxPrice`/`sortBy` to a rooms query builder — the single place
   * every rooms-listing query goes through so "cheapest" always means the
   * same thing regardless of which other filters (name/guests/level/date)
   * are also applied. `most_amenities` needs `cardinality()` (Postgres array
   * function), which is only expressible via the query builder, not the ORM's
   * plain `find({ order })` shorthand — the reason every listing method below
   * uses a query builder even when it has no other filters.
   *
   * @param qb - Query builder for the `room` alias, filters already applied
   * @param options - Ranking options; a given `sortBy` replaces `defaultOrderBy`
   * @param defaultOrderBy - Ordering to fall back to when no `sortBy` is given
   */
  private applyRoomRanking(
    qb: SelectQueryBuilder<RoomEntity>,
    options: RoomRankingOptions | undefined,
    defaultOrderBy: () => void,
  ): void {
    if (options?.maxPrice != null) {
      qb.andWhere('room.pricePerNight <= :maxPrice', {
        maxPrice: options.maxPrice,
      });
    }

    switch (options?.sortBy) {
      case FIND_ROOM_SORT.CHEAPEST:
        qb.orderBy('room.pricePerNight', 'ASC').addOrderBy('room.name', 'ASC');
        return;
      case FIND_ROOM_SORT.MOST_EXPENSIVE:
        qb.orderBy('room.pricePerNight', 'DESC').addOrderBy('room.name', 'ASC');
        return;
      case FIND_ROOM_SORT.MOST_AMENITIES:
        qb.orderBy('cardinality(room.amenities)', 'DESC')
          .addOrderBy('room.pricePerNight', 'ASC')
          .addOrderBy('room.name', 'ASC');
        return;
      default:
        defaultOrderBy();
    }
  }

  async findAll(options?: RoomRankingOptions): Promise<RoomEntity[]> {
    const qb = this.roomRepository.createQueryBuilder('room');
    this.applyRoomRanking(qb, options, () => qb.orderBy('room.name', 'ASC'));
    return qb.getMany();
  }

  async findById(id: string, userId?: string): Promise<RoomEntity | null> {
    if (!userId) {
      return this.roomRepository.findOne({ where: { id } });
    }

    return this.roomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect(
        'room.bookings',
        'booking',
        'booking.userId = :userId AND booking.status IN (:...activeStatuses)',
        { userId, activeStatuses: ACTIVE_BOOKING_STATUSES },
      )
      .where('room.id = :id', { id })
      .orderBy('booking.createdAt', 'DESC')
      .getOne();
  }

  async findAvailableBetween(
    checkInDate: Date,
    checkOutDate: Date,
    options?: RoomRankingOptions,
  ): Promise<RoomEntity[]> {
    const qb = this.roomRepository
      .createQueryBuilder('room')
      .leftJoin('room.bookings', 'booking', BOOKING_OVERLAP_JOIN_CONDITION, {
        activeStatuses: ACTIVE_BOOKING_STATUSES,
        checkOutDate,
        checkInDate,
      })
      .where('room.availableSlots > 0')
      .andWhere('booking.id IS NULL');
    this.applyRoomRanking(qb, options, () => qb.orderBy('room.name', 'ASC'));
    return qb.getMany();
  }

  /**
   * Finds rooms matching optional name, capacity, level, and availability filters.
   * Guest count is a minimum (`capacity >= guests`), never an exact match.
   *
   * @param filters - Combined search/filter criteria; omit a field to skip it
   * @returns Matching rooms ordered by smallest sufficient capacity, then name
   *   — or by `sortBy`, when given, instead
   */
  async findByFilters(
    filters: {
      name?: string;
      guests?: number;
      level?: number;
      checkInDate?: Date;
      checkOutDate?: Date;
    } & RoomRankingOptions,
  ): Promise<RoomEntity[]> {
    const qb = this.roomRepository.createQueryBuilder('room');

    if (filters.checkInDate && filters.checkOutDate) {
      qb.leftJoin('room.bookings', 'booking', BOOKING_OVERLAP_JOIN_CONDITION, {
        activeStatuses: ACTIVE_BOOKING_STATUSES,
        checkOutDate: filters.checkOutDate,
        checkInDate: filters.checkInDate,
      })
        .andWhere('room.availableSlots > 0')
        .andWhere('booking.id IS NULL');
    }

    if (filters.name?.trim()) {
      qb.andWhere('LOWER(room.name) LIKE LOWER(:name)', {
        name: `%${filters.name.trim()}%`,
      });
    }

    // Party size is a floor: a room for 4 guests is valid for a party of 3.
    if (filters.guests != null && !Number.isNaN(filters.guests)) {
      qb.andWhere('room.capacity >= :guests', { guests: filters.guests });
    }

    if (filters.level != null && !Number.isNaN(filters.level)) {
      qb.andWhere('room.level = :level', { level: filters.level });
    }

    this.applyRoomRanking(qb, filters, () =>
      qb.orderBy('room.capacity', 'ASC').addOrderBy('room.name', 'ASC'),
    );

    return qb.getMany();
  }

  async findActiveBookingByRoomAndUser(
    roomId: string,
    userId: string,
  ): Promise<BookingEntity | null> {
    return this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.roomId = :roomId', { roomId })
      .andWhere('booking.userId = :userId', { userId })
      .andWhere('booking.status IN (:...activeStatuses)', {
        activeStatuses: ACTIVE_BOOKING_STATUSES,
      })
      .orderBy('booking.createdAt', 'DESC')
      .getOne();
  }

  async hasOverlappingActiveBooking(
    roomId: string,
    checkInDate: string,
    checkOutDate: string,
  ): Promise<boolean> {
    const overlapCount = await this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.roomId = :roomId', { roomId })
      .andWhere('booking.status IN (:...activeStatuses)', {
        activeStatuses: ACTIVE_BOOKING_STATUSES,
      })
      .andWhere('booking.checkInDate < :checkOutDate', { checkOutDate })
      .andWhere('booking.checkOutDate > :checkInDate', { checkInDate })
      .getCount();

    return overlapCount > 0;
  }
}
