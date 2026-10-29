import { createClerkClient } from '@clerk/backend';
import type { Repository } from 'typeorm';

import { UserRole } from '@/database/entities/enums';
import type { UserEntity } from '@/database/entities/user.entity';
import { UsersService } from './users.service';

jest.mock('@clerk/backend', () => ({ createClerkClient: jest.fn() }));

describe('UsersService.findOrCreate', () => {
  const originalSecret = process.env.CLERK_SECRET_KEY;
  let findOne: jest.Mock;
  let save: jest.Mock;
  let getUser: jest.Mock;
  let service: UsersService;

  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test';
    findOne = jest.fn().mockResolvedValue(null);
    save = jest.fn().mockImplementation((u: unknown) => Promise.resolve(u));
    getUser = jest.fn();
    (createClerkClient as jest.Mock).mockReturnValue({ users: { getUser } });
    service = new UsersService({
      findOne,
      save,
    } as unknown as Repository<UserEntity>);
  });

  afterAll(() => {
    process.env.CLERK_SECRET_KEY = originalSecret;
  });

  it('stores the Clerk name and primary email for a new user', async () => {
    getUser.mockResolvedValue({
      firstName: 'Jane',
      lastName: 'Doe',
      username: 'jd',
      primaryEmailAddressId: 'e2',
      emailAddresses: [
        { id: 'e1', emailAddress: 'old@example.com' },
        { id: 'e2', emailAddress: 'jane@example.com' },
      ],
    });

    const user = await service.findOrCreate('user_1');

    expect(user).toMatchObject({
      id: 'user_1',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: UserRole.GUEST,
    });
  });

  it('falls back to the username when there is no first or last name', async () => {
    getUser.mockResolvedValue({
      firstName: null,
      lastName: null,
      username: 'jd',
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: 'jane@example.com' }],
    });

    await expect(service.findOrCreate('user_1')).resolves.toMatchObject({
      name: 'jd',
    });
  });

  it('falls back to placeholder values when Clerk fails', async () => {
    getUser.mockRejectedValue(new Error('clerk down'));

    await expect(service.findOrCreate('user_1')).resolves.toMatchObject({
      id: 'user_1',
      email: 'user_1@users.local',
      name: null,
    });
  });

  it('does not call Clerk for a real email with a null name', async () => {
    const row = {
      id: 'user_1',
      email: 'jane@example.com',
      name: null,
      role: UserRole.GUEST,
    };
    findOne.mockResolvedValue(row);

    await expect(service.findOrCreate('user_1')).resolves.toBe(row);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('updates an existing placeholder row from Clerk', async () => {
    findOne.mockResolvedValue({
      id: 'user_1',
      email: 'user_1@users.local',
      name: null,
      role: UserRole.GUEST,
    });
    getUser.mockResolvedValue({
      firstName: 'Jane',
      lastName: null,
      username: null,
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: 'jane@example.com' }],
    });

    await expect(service.findOrCreate('user_1')).resolves.toMatchObject({
      email: 'jane@example.com',
      name: 'Jane',
    });
  });
});
