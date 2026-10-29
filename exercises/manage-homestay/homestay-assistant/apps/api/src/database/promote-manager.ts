import 'reflect-metadata';
import 'dotenv/config';
import dataSource from '@/database/data-source';
import { UserRole } from '@/database/entities/enums';
import { UserEntity } from '@/database/entities/user.entity';
import { UsersService } from '@/modules/users/services/users.service';

const parseUserIds = (value: string | undefined): string[] =>
  Array.from(
    new Set(
      (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

async function main(): Promise<void> {
  const userIds = parseUserIds(process.env.MANAGER_CLERK_USER_IDS);
  if (userIds.length === 0) {
    throw new Error(
      'MANAGER_CLERK_USER_IDS is empty. Set it to a comma-separated list of Clerk user ids.',
    );
  }

  await dataSource.initialize();
  const usersService = new UsersService(dataSource.getRepository(UserEntity));

  for (const userId of userIds) {
    const user = await usersService.upsertWithRole(userId, UserRole.MANAGER);
    console.log(`Promoted ${user.id} (${user.email}) to ${user.role}.`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });
