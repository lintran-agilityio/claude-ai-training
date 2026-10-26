import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckedInOutBookingStatuses20260713180000 implements MigrationInterface {
  name = 'AddCheckedInOutBookingStatuses20260713180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CHECKED_IN'`,
    );
    await queryRunner.query(
      `ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CHECKED_OUT'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres cannot drop enum values; leaving them is harmless.
  }
}
