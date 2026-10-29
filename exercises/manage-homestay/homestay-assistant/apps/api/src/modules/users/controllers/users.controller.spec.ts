import { UserRole } from '@/database/entities/enums';
import type { UserEntity } from '@/database/entities/user.entity';
import { UsersController } from '@/modules/users/controllers/users.controller';
import type { UsersService } from '@/modules/users/services/users.service';

describe('UsersController.me', () => {
  it('returns id, email, name and role', async () => {
    const findOrCreate = jest.fn().mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: UserRole.GUEST,
    } as UserEntity);
    const controller = new UsersController({
      findOrCreate,
    } as unknown as UsersService);

    await expect(
      controller.me({ userId: 'user_1', role: UserRole.MANAGER }),
    ).resolves.toEqual({
      id: 'user_1',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: UserRole.MANAGER,
    });
    expect(findOrCreate).toHaveBeenCalledWith('user_1');
  });
});
