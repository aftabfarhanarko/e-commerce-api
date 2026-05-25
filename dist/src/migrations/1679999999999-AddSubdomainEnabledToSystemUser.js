"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSubdomainEnabledToSystemUser1679999999999 = void 0;
class AddSubdomainEnabledToSystemUser1679999999999 {
    async up(queryRunner) {
        try {
            await queryRunner.query(`
        ALTER TABLE "system_users"
        ADD COLUMN IF NOT EXISTS "subdomainEnabled" boolean NOT NULL DEFAULT true
      `);
        }
        catch (e) {
            console.warn('Migration AddSubdomainEnabledToSystemUser1679999999999 up failed, continuing:', e.message);
        }
    }
    async down(queryRunner) {
        try {
            await queryRunner.query(`
        ALTER TABLE "system_users"
        DROP COLUMN IF EXISTS "subdomainEnabled"
      `);
        }
        catch (e) {
            console.warn('Migration AddSubdomainEnabledToSystemUser1679999999999 down failed, continuing:', e.message);
        }
    }
}
exports.AddSubdomainEnabledToSystemUser1679999999999 = AddSubdomainEnabledToSystemUser1679999999999;
//# sourceMappingURL=1679999999999-AddSubdomainEnabledToSystemUser.js.map