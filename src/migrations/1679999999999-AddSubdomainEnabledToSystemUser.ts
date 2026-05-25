import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubdomainEnabledToSystemUser1679999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`
        ALTER TABLE "system_users"
        ADD COLUMN IF NOT EXISTS "subdomainEnabled" boolean NOT NULL DEFAULT true
      `);
    } catch (e) {
      console.warn('Migration AddSubdomainEnabledToSystemUser1679999999999 up failed, continuing:', e.message);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`
        ALTER TABLE "system_users"
        DROP COLUMN IF EXISTS "subdomainEnabled"
      `);
    } catch (e) {
      console.warn('Migration AddSubdomainEnabledToSystemUser1679999999999 down failed, continuing:', e.message);
    }
  }
}

