"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let MigrationController = class MigrationController {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async runMigrations() {
        try {
            await this.dataSource.query('ALTER TABLE system_users ADD COLUMN IF NOT EXISTS "paidTotalEarning" numeric(12,2) NOT NULL DEFAULT 0');
            await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "sizes" text');
            await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "variants" text');
            await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "types" text');
            await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "weight" numeric(10,2)');
            await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "length" numeric(10,2)');
            await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "breadth" numeric(10,2)');
            await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "width" numeric(10,2)');
            await this.dataSource.query('ALTER TABLE tbl_products ADD COLUMN IF NOT EXISTS "unit" character varying DEFAULT \'Piece\'');
            await this.dataSource.query('ALTER TABLE tbl_settings ADD COLUMN IF NOT EXISTS "fraudCheckerApiKey" text');
            await this.dataSource.query(`SELECT setval(pg_get_serial_sequence('system_users', 'id'), coalesce(max(id)+1, 1), false) FROM system_users;`);
            await this.dataSource.runMigrations();
            return { success: true, message: "Migrations run successfully on Vercel!" };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    }
};
exports.MigrationController = MigrationController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MigrationController.prototype, "runMigrations", null);
exports.MigrationController = MigrationController = __decorate([
    (0, common_1.Controller)('run-migrations'),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], MigrationController);
//# sourceMappingURL=migration.controller.js.map