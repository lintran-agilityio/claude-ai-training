import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createClerkClient } from '@clerk/backend';
import { Repository } from 'typeorm';

import { UserRole } from '@/database/entities/enums';
import { UserEntity } from '@/database/entities/user.entity';

const PLACEHOLDER_EMAIL_SUFFIX = '@users.local';
const PLACEHOLDER_PASSWORD = 'n/a';

type ClerkProfile = { email: string | null; name: string | null };

const placeholderEmail = (userId: string) =>
  `${userId}${PLACEHOLDER_EMAIL_SUFFIX}`;

const isPlaceholder = (user: UserEntity) =>
  user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX);

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /** Returns the user row, creating it (with the Clerk profile) when missing. */
  async findOrCreate(userId: string): Promise<UserEntity> {
    const existing = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (existing) {
      return isPlaceholder(existing) ? this.syncProfile(existing) : existing;
    }

    const profile = await this.fetchClerkProfile(userId);

    return this.userRepository.save({
      id: userId,
      email: profile?.email ?? placeholderEmail(userId),
      name: profile?.name ?? null,
      password: PLACEHOLDER_PASSWORD,
      role: UserRole.GUEST,
      updatedAt: new Date(),
    });
  }

  /** Creates the user if missing and sets its role. */
  async upsertWithRole(userId: string, role: UserRole): Promise<UserEntity> {
    const user = await this.findOrCreate(userId);

    if (user.role === role) {
      return user;
    }

    return this.userRepository.save({ ...user, role, updatedAt: new Date() });
  }

  /** Syncs name/email from Clerk for every placeholder row. Returns the number updated. */
  async backfillProfiles(): Promise<number> {
    const rows = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email LIKE :suffix', {
        suffix: `%${PLACEHOLDER_EMAIL_SUFFIX}`,
      })
      .getMany();

    let updated = 0;
    for (const row of rows) {
      const before = `${row.name}|${row.email}`;
      const synced = await this.syncProfile(row);
      if (`${synced.name}|${synced.email}` !== before) {
        updated += 1;
      }
    }

    return updated;
  }

  /** Replaces placeholder name/email with Clerk data; keeps the row as-is on failure. */
  private async syncProfile(user: UserEntity): Promise<UserEntity> {
    const profile = await this.fetchClerkProfile(user.id);
    if (!profile) {
      return user;
    }

    const name = user.name ?? profile.name;
    const email =
      user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX) && profile.email
        ? profile.email
        : user.email;

    if (name === user.name && email === user.email) {
      return user;
    }

    try {
      return await this.userRepository.save({
        ...user,
        name,
        email,
        updatedAt: new Date(),
      });
    } catch (error) {
      // e.g. unique email collision; the placeholder row remains usable.
      this.logger.warn(
        `Could not store Clerk profile for user ${user.id}: ${String(error)}`,
      );
      return user;
    }
  }

  private async fetchClerkProfile(
    userId: string,
  ): Promise<ClerkProfile | null> {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      this.logger.warn(
        `CLERK_SECRET_KEY is not set; using placeholder profile for user ${userId}`,
      );
      return null;
    }

    try {
      const clerkUser = await createClerkClient({ secretKey }).users.getUser(
        userId,
      );
      const primaryEmail =
        clerkUser.emailAddresses.find(
          (address) => address.id === clerkUser.primaryEmailAddressId,
        ) ?? clerkUser.emailAddresses[0];
      const fullName = [clerkUser.firstName, clerkUser.lastName]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(' ')
        .trim();

      return {
        email: primaryEmail?.emailAddress ?? null,
        name: fullName || clerkUser.username || null,
      };
    } catch (error) {
      this.logger.warn(
        `Clerk profile lookup failed for user ${userId}; using placeholder values: ${String(error)}`,
      );
      return null;
    }
  }
}
