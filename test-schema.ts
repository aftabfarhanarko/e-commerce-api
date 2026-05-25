import { DataSource } from 'typeorm';
import { SystemUser } from './src/systemuser/entities/systemuser.entity';
import { ProductEntity } from './src/products/entities/product.entity';
import { CategoryEntity } from './src/category/entities/category.entity';
import { Order } from './src/orders/entities/order.entity';
// ... actually it's easier to just import AppModule and get the DataSource
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getConnectionToken } from '@nestjs/typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(getConnectionToken());
  const sqlInMemory = await dataSource.driver.createSchemaBuilder().log();
  console.log("=== SYNC QUERIES ===");
  console.log(sqlInMemory.upQueries.map(q => q.query).join(';\n'));
  await app.close();
}
bootstrap();
