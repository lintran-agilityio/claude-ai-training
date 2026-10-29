import type { UserRole } from '@/database/entities/enums';

export type ClerkAuthUser = {
  userId: string;
  role: UserRole;
};
