import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SuperadminService } from './superadmin/superadmin.service';

import { FeaturePermission } from './systemuser/feature-permission.enum';

/**
 * Standalone script to create an initial superadmin user.
 * Run with: railway run npx ts-node create-superadmin.ts
 */
async function bootstrap() {
  console.log('Starting superadmin creation script...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const superadminService = app.get(SuperadminService);

  const email = 'aftabfarhan324@gmail.com';
  const name = 'Aftab Farhan';
  const password = 'SuperAdminPassword123!';

  console.log(`Attempting to create superadmin: ${email}`);

  try {
    const user = await superadminService.create({
      email,
      name,
      password,
      designation: 'Super Admin',
      permissions: Object.values(FeaturePermission) as any,
    });
    console.log('✅ Superadmin created successfully:', user);
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log('ℹ️ Superadmin already exists.');
    } else {
      console.error('❌ Failed to create superadmin:', error.message);
    }
  } finally {
    await app.close();
    console.log('Script finished.');
  }
}

bootstrap();
