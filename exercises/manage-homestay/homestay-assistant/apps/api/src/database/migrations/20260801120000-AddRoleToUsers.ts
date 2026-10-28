import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleToUsers20260801120000 implements MigrationInterface {
  name = 'AddRoleToUsers20260801120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" character varying NOT NULL DEFAULT 'guest'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_users_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_role" CHECK ("role" IN ('guest', 'manager'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_users_role"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
  }
}
