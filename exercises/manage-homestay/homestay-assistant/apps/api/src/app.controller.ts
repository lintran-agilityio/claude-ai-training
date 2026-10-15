import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { RootResponseDto } from './root-response.dto';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API health and today’s available room count' })
  @ApiOkResponse({ type: RootResponseDto })
  async getRoot(): Promise<RootResponseDto> {
    const rooms = await this.appService.getAvailableRoomsToday();

    return {
      message: this.appService.getHello(),
      availableRoomsToday: rooms.length,
    };
  }
}
