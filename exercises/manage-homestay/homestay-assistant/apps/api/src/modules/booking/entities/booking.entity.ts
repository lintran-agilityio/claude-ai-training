import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { BookingStatus } from '../../../types/enum';
import { BaseEntity } from '../../../common/base/entity';
import { UserEntity } from '@/database/entities/user.entity';
import { RoomEntity } from '@/modules/rooms/entities/room.entity';

@Entity('bookings')
@Index(['roomId', 'checkInDate', 'checkOutDate'])
export class BookingEntity extends BaseEntity {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.bookings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => RoomEntity, (room) => room.bookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'room_id' })
  room: RoomEntity;

  @Column({ name: 'check_in_date', type: 'date' })
  checkInDate: string;

  @Column({ name: 'check_out_date', type: 'date' })
  checkOutDate: string;

  @Column()
  guests: number;

  @Column({ name: 'total_price' })
  totalPrice: number;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    enumName: 'BookingStatus',
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;
}
