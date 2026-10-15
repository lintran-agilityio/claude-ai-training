import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsController } from '@/modules/rooms/controllers/rooms.controller';
import { BookingEntity } from '@/modules/booking/entities/booking.entity';
import { RoomEntity } from '@/modules/rooms/entities/room.entity';
import { RoomsRepository } from '@/modules/rooms/repositories/rooms.repository';
import { RoomsService } from '@/modules/rooms/services/rooms.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoomEntity, BookingEntity])],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsRepository],
  exports: [RoomsService, RoomsRepository],
})
export class RoomsModule {}
