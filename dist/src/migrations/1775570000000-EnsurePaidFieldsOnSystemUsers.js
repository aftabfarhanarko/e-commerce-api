"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnsurePaidFieldsOnSystemUsers1775570000000 = void 0;
class EnsurePaidFieldsOnSystemUsers1775570000000 {
    constructor() {
        this.name = 'EnsurePaidFieldsOnSystemUsers1775570000000';
        this.transaction = false;
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "system_users" ADD COLUMN IF NOT EXISTS "paidTotalSoldQty" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "system_users" ADD COLUMN IF NOT EXISTS "paidTotalEarning" numeric(12,2) NOT NULL DEFAULT 0`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "system_users" DROP COLUMN IF EXISTS "paidTotalEarning"`);
        await queryRunner.query(`ALTER TABLE "system_users" DROP COLUMN IF EXISTS "paidTotalSoldQty"`);
    }
}
exports.EnsurePaidFieldsOnSystemUsers1775570000000 = EnsurePaidFieldsOnSystemUsers1775570000000;
//# sourceMappingURL=1775570000000-EnsurePaidFieldsOnSystemUsers.js.map