import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('run-migrations')
export class MigrationController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async runMigrations() {
    try {
      await this.dataSource.query('ALTER TABLE system_users ADD COLUMN IF NOT EXISTS "paidTotalSoldQty" integer NOT NULL DEFAULT 0');
      await this.dataSource.query('ALTER TABLE system_users ADD COLUMN IF NOT EXISTS "paidTotalEarning" numeric(12,2) NOT NULL DEFAULT 0');
      await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "sizes" text');
      await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "variants" text');
      await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "types" text');
      await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "weight" numeric(10,2)');
      await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "length" numeric(10,2)');
      await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "breadth" numeric(10,2)');
      await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "width" numeric(10,2)');
      await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "unit" character varying DEFAULT \'Piece\'');
      await this.dataSource.query('ALTER TABLE tbl_settings ADD COLUMN IF NOT EXISTS "fraudCheckerApiKey" text');
      await this.dataSource.runMigrations();
      return { success: true, message: "Migrations run successfully on Vercel!" };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
