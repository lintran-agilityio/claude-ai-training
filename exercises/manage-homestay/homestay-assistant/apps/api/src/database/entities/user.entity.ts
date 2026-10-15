import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/base/entity';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @PrimaryColumn('text')
  id: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar' })
  password: string;

  @OneToMany(() => BookingEntity, (booking) => booking.user)
  bookings: BookingEntity[];
}
