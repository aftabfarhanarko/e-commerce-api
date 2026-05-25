import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('debug')
export class DebugController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('db')
  async getDbInfo() {
    try {
      const dbInfo = await this.dataSource.query('SELECT current_database() as db, current_schema() as schema, version() as v');
      const columns = await this.dataSource.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tbl_products'");
      return { 
        success: true, 
        info: dbInfo[0],
        columns: columns.map(c => c.column_name)
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
