import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelledAtToBookings20260713170000
  implements MigrationInterface
{
  name = 'AddCancelledAtToBookings20260713170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "cancelled_at"`,
    );
  }
}
