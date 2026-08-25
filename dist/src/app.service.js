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
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const superadmin_service_1 = require("./superadmin/superadmin.service");
const feature_permission_enum_1 = require("./systemuser/feature-permission.enum");
let AppService = class AppService {
    constructor(superadminService) {
        this.superadminService = superadminService;
    }
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
                    permissions: Object.values(feature_permission_enum_1.FeaturePermission),
                });
                console.log(`✅ Default Superadmin created: ${email}`);
            }
        }
        catch (err) {
            console.warn('Superadmin auto-seed notice:', err?.message || err);
        }
    }
    getHello() {
        return 'Hello World!';
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [superadmin_service_1.SuperadminService])
], AppService);
//# sourceMappingURL=app.service.js.map