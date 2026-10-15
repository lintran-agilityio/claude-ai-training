import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/base/entity';
import { Amenity } from '@/database/entities/enums';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';

@Entity('rooms')
export class RoomEntity extends BaseEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  level: number;

  @Column({ name: 'level_color' })
  levelColor: string;

  @Column()
  capacity: number;

  @Column()
  description: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({ name: 'available_slots' })
  availableSlots: number;

  @Column({ name: 'price_per_night', default: 0 })
  pricePerNight: number;

  @Column({
    type: 'enum',
    enum: Amenity,
    enumName: 'Amenity',
    array: true,
  })
  amenities: Amenity[];

  @OneToMany(() => BookingEntity, (booking) => booking.room)
  bookings: BookingEntity[];
}
