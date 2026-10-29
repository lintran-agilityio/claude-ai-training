import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ClerkAuthGuard, CurrentUser, type ClerkAuthUser } from '@/auth';
import { AvailabilityOverviewQueryDto } from '@/modules/rooms/dto/availability-overview-query.dto';
import { AvailabilityOverviewResponseDto } from '@/modules/rooms/dto/availability-overview-response.dto';
import { GetAvailableRoomsQueryDto } from '@/modules/rooms/dto/get-available-rooms-query.dto';
import { GetRoomByIdQueryDto } from '@/modules/rooms/dto/get-room-by-id-query.dto';
import { CreateRoomDto } from '@/modules/rooms/dto/create-room.dto';
import { UpdateRoomDto } from '@/modules/rooms/dto/update-room.dto';
import { RoomResponseDto } from '@/modules/rooms/dto/room-response.dto';
import { RoomsService } from '@/modules/rooms/services/rooms.service';

@ApiTags('rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List all rooms, or filter by date availability, name, guests, level, and/or price — optionally ranked by sortBy',
  })
  @ApiOkResponse({ type: RoomResponseDto, isArray: true })
  getRooms(
    @Query() query: GetAvailableRoomsQueryDto,
  ): Promise<RoomResponseDto[]> {
    return this.roomsService.getRooms(query);
  }

  // Declared before `:id` so "availability-overview" is not captured as an id.
  @Get('availability-overview')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Read-only availability overview for a date: free rooms for everyone; booked rooms with guest names for managers only',
  })
  @ApiOkResponse({ type: AvailabilityOverviewResponseDto })
  getAvailabilityOverview(
    @CurrentUser() user: ClerkAuthUser,
    @Query() query: AvailabilityOverviewQueryDto,
  ): Promise<AvailabilityOverviewResponseDto> {
    return this.roomsService.getAvailabilityOverview(query, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single room by ID' })
  @ApiOkResponse({ type: RoomResponseDto })
  getRoomById(
    @Param('id') id: string,
    @Query() query: GetRoomByIdQueryDto,
  ): Promise<RoomResponseDto> {
    return this.roomsService.getRoomById(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a room' })
  @ApiOkResponse({ type: RoomResponseDto })
  createRoom(@Body() dto: CreateRoomDto): Promise<RoomResponseDto> {
    return this.roomsService.createRoom(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a room' })
  @ApiOkResponse({ type: RoomResponseDto })
  updateRoom(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<RoomResponseDto> {
    return this.roomsService.updateRoom(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a room without active bookings' })
  deleteRoom(@Param('id') id: string): Promise<void> {
    return this.roomsService.deleteRoom(id);
  }
}
