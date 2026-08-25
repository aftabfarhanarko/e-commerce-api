import { Injectable, OnModuleInit } from '@nestjs/common';
import { SuperadminService } from './superadmin/superadmin.service';
import { FeaturePermission } from './systemuser/feature-permission.enum';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly superadminService: SuperadminService) {}

  async onModuleInit() {
    try {
      const email = 'aftabfarhan324@gmail.com';
      const password = 'SuperAdminPassword123!';
      const existing = await this.superadminService.findByEmail(email);
      if (!existing) {
        await this.superadminService.create({
          email,
          name: 'Aftab Farhan',
          password,
          designation: 'Super Admin',
          permissions: Object.values(FeaturePermission) as any,
        });
        console.log(`✅ Default Superadmin created: ${email}`);
      }
    } catch (err) {
      console.warn('Superadmin auto-seed notice:', err?.message || err);
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
