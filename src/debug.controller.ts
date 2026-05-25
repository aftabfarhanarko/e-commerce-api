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

  @Get('fix-vercel-db')
  async fixVercelDb() {
    try {
      // 1. Rebuild tbl_settings
      await this.dataSource.query("CREATE TABLE IF NOT EXISTS tbl_settings_new (LIKE tbl_settings INCLUDING ALL); INSERT INTO tbl_settings_new SELECT * FROM tbl_settings; DROP TABLE tbl_settings CASCADE; ALTER TABLE tbl_settings_new RENAME TO tbl_settings;");
      
      // 2. Rebuild tbl_products
      await this.dataSource.query("CREATE TABLE IF NOT EXISTS tbl_products_new (LIKE tbl_products INCLUDING ALL); INSERT INTO tbl_products_new SELECT * FROM tbl_products; DROP TABLE tbl_products CASCADE; ALTER TABLE tbl_products_new RENAME TO tbl_products;");
      
      // 3. Rebuild system_users
      await this.dataSource.query("CREATE TABLE IF NOT EXISTS system_users_new (LIKE system_users INCLUDING ALL); INSERT INTO system_users_new SELECT * FROM system_users; DROP TABLE system_users CASCADE; ALTER TABLE system_users_new RENAME TO system_users;");
      
      // 4. Rebuild orders
      await this.dataSource.query("CREATE TABLE IF NOT EXISTS orders_new (LIKE orders INCLUDING ALL); INSERT INTO orders_new SELECT * FROM orders; DROP TABLE orders CASCADE; ALTER TABLE orders_new RENAME TO orders;");
      
      // 5. Data mapping for orders (skip if totalAmount already exists)
      try {
        await this.dataSource.query('ALTER TABLE orders ADD COLUMN "totalAmount" numeric(12,2) DEFAULT \'0\'');
        await this.dataSource.query('UPDATE orders SET "totalAmount" = amount WHERE amount IS NOT NULL');
      } catch (e) {
        console.log("totalAmount might already exist");
      }
      try {
        await this.dataSource.query('ALTER TABLE orders ADD COLUMN "customerId" integer');
        await this.dataSource.query('UPDATE orders SET "customerId" = NULL');
      } catch (e) {
        console.log("customerId might already exist");
      }

      // 6. Run typeorm schema sync
      await this.dataSource.synchronize();

      return { success: true, message: "Vercel DB successfully fixed and synced!" };
    } catch (e) {
      return { success: false, error: e.message, stack: e.stack };
    }
  }
}
