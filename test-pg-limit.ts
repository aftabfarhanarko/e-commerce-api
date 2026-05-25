import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getConnectionToken } from '@nestjs/typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(getConnectionToken());
  
  await dataSource.query(`CREATE TABLE orders_new (LIKE orders INCLUDING ALL);`);
  const res = await dataSource.query(`SELECT count(*) FROM pg_attribute WHERE attrelid = 'orders_new'::regclass;`);
  console.log('NEW TABLE COLUMNS:', res);
  await dataSource.query(`DROP TABLE orders_new;`);
  
  await app.close();
}
bootstrap();
