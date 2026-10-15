import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema20260623161015 implements MigrationInterface {
  name = 'InitialSchema20260623161015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "Amenity" AS ENUM ('monitor', 'coffee', 'mic', 'wifi', 'video', 'whiteboard', 'phone')`,
    );
    await queryRunner.query(
      `CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "level" INTEGER NOT NULL,
        "level_color" TEXT NOT NULL,
        "capacity" INTEGER NOT NULL,
        "description" TEXT NOT NULL,
        "image_url" TEXT NOT NULL,
        "available_slots" INTEGER NOT NULL,
        "price_per_night" INTEGER NOT NULL DEFAULT 0,
        "amenities" "Amenity"[],
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "name" TEXT,
        "password" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "room_id" TEXT NOT NULL,
        "check_in_date" DATE NOT NULL,
        "check_out_date" DATE NOT NULL,
        "guests" INTEGER NOT NULL,
        "total_price" INTEGER NOT NULL,
        "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
        "cancelled_at" TIMESTAMP,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_key" ON "users"("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "bookings_room_id_check_in_date_check_out_date_idx" ON "bookings"("room_id", "check_in_date", "check_out_date")`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "bookings_room_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "bookings_user_id_fkey"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."bookings_room_id_check_in_date_check_out_date_idx"`,
    );
    await queryRunner.query(`DROP INDEX "public"."users_email_key"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TYPE "BookingStatus"`);
    await queryRunner.query(`DROP TYPE "Amenity"`);
  }
}
