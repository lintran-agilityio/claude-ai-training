import 'reflect-metadata';
import 'dotenv/config';
import dataSource from '@/database/data-source';
import { UserEntity } from '@/database/entities/user.entity';
import { UsersService } from '@/modules/users/services/users.service';

async function main(): Promise<void> {
  await dataSource.initialize();
  const usersService = new UsersService(dataSource.getRepository(UserEntity));

  const updated = await usersService.backfillProfiles();
  console.log(`Backfilled ${updated} user profile(s) from Clerk.`);
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
