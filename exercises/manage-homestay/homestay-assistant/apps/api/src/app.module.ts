import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { DatabaseModule } from './database/database.module';
import { BookingModule } from './modules/booking/booking.module';
import { RoomsModule } from './modules/rooms/rooms.module';

@Module({
  imports: [AuthModule, DatabaseModule, RoomsModule, BookingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
