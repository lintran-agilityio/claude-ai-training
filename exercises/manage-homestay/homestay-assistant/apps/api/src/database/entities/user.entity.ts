import { Check, Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/base/entity';
import { UserRole } from './enums';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';

@Entity('users')
@Check('CHK_users_role', `"role" IN ('guest', 'manager')`)
export class UserEntity extends BaseEntity {
  @PrimaryColumn('text')
  id: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'varchar', default: UserRole.GUEST })
  role: UserRole;

  @OneToMany(() => BookingEntity, (booking) => booking.user)
  bookings: BookingEntity[];
}
