import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomsService } from './modules/rooms/services/rooms.service';

describe('AppController', () => {
  let appController: AppController;

  const roomsServiceMock = {
    getRooms: jest.fn().mockResolvedValue([
      { id: 'meridian', name: 'The Meridian' },
    ]),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: RoomsService, useValue: roomsServiceMock },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns api message and available room count', async () => {
      await expect(appController.getRoot()).resolves.toEqual({
        message: 'Homestay Assistant API',
        availableRoomsToday: 1,
      });
    });
  });
});
