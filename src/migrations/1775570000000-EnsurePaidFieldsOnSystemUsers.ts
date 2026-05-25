import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsurePaidFieldsOnSystemUsers1775570000000
  implements MigrationInterface
{
  name = 'EnsurePaidFieldsOnSystemUsers1775570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_users" ADD COLUMN IF NOT EXISTS "paidTotalSoldQty" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "system_users" ADD COLUMN IF NOT EXISTS "paidTotalEarning" numeric(12,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "system_users" DROP COLUMN IF EXISTS "paidTotalEarning"`,
    );
    await queryRunner.query(
      `ALTER TABLE "system_users" DROP COLUMN IF EXISTS "paidTotalSoldQty"`,
    );
  }
}
