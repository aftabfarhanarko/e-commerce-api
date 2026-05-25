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
      await this.dataSource.runMigrations();
      return { success: true, message: "Migrations run successfully on Vercel!" };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
