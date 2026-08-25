"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const superadmin_service_1 = require("./superadmin/superadmin.service");
const feature_permission_enum_1 = require("./systemuser/feature-permission.enum");
async function bootstrap() {
    console.log('Starting superadmin creation script...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const superadminService = app.get(superadmin_service_1.SuperadminService);
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
            permissions: Object.values(feature_permission_enum_1.FeaturePermission),
        });
        console.log('✅ Superadmin created successfully:', user);
    }
    catch (error) {
        if (error.message?.includes('already exists')) {
            console.log('ℹ️ Superadmin already exists.');
        }
        else {
            console.error('❌ Failed to create superadmin:', error.message);
        }
    }
    finally {
        await app.close();
        console.log('Script finished.');
    }
}
bootstrap();
//# sourceMappingURL=create-superadmin.js.map