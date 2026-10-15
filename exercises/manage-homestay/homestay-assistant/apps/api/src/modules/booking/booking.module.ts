import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@/database/entities/user.entity';
import { RoomsModule } from '@/modules/rooms/rooms.module';
import { BookingController } from '@/modules/booking/controllers/booking.controller';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import { BookingRepository } from '@/modules/booking/repositories/booking.repository';
import { BookingService } from '@/modules/booking/services/booking.service';

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity, UserEntity]), RoomsModule],
  controllers: [BookingController],
  providers: [BookingService, BookingRepository],
  exports: [BookingService],
})
export class BookingModule {}
