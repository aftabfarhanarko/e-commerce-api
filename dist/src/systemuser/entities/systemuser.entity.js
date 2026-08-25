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
exports.SystemUser = void 0;
const typeorm_1 = require("typeorm");
const package_entity_1 = require("../../package/entities/package.entity");
const invoice_entity_1 = require("../../invoice/entities/invoice.entity");
const theme_entity_1 = require("../../theme/entities/theme.entity");
const system_user_role_enum_1 = require("../system-user-role.enum");
let SystemUser = class SystemUser {
};
exports.SystemUser = SystemUser;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SystemUser.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SystemUser.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "designation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "photo", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: false }),
    __metadata("design:type", String)
], SystemUser.prototype, "companyName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: false }),
    __metadata("design:type", String)
], SystemUser.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', unique: true, nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "subdomain", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], SystemUser.prototype, "subdomainEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', unique: true, nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "customDomain", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 32,
        default: 'pending_dns',
    }),
    __metadata("design:type", String)
], SystemUser.prototype, "customDomainStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "customDomainVerificationCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, name: 'custom_domain_verified_at' }),
    __metadata("design:type", Date)
], SystemUser.prototype, "customDomainVerifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true, name: 'ssl_provisioned_at' }),
    __metadata("design:type", Date)
], SystemUser.prototype, "sslProvisionedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true, name: 'cloudflare_hostname_id' }),
    __metadata("design:type", String)
], SystemUser.prototype, "cloudflareHostnameId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "companyLogo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "branchLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "primaryColor", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "secondaryColor", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "passwordSalt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SystemUser.prototype, "resetPasswordToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], SystemUser.prototype, "resetPasswordExpires", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], SystemUser.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)('json', { nullable: true }),
    __metadata("design:type", Object)
], SystemUser.prototype, "paymentInfo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], SystemUser.prototype, "packageId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => package_entity_1.Package, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'packageId' }),
    __metadata("design:type", package_entity_1.Package)
], SystemUser.prototype, "package", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Number)
], SystemUser.prototype, "previousPackageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], SystemUser.prototype, "themeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => theme_entity_1.Theme, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'themeId' }),
    __metadata("design:type", theme_entity_1.Theme)
], SystemUser.prototype, "theme", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => invoice_entity_1.Invoice, (invoice) => invoice.customer),
    __metadata("design:type", Array)
], SystemUser.prototype, "invoices", void 0);
__decorate([
    (0, typeorm_1.Column)('json', { nullable: true }),
    __metadata("design:type", Object)
], SystemUser.prototype, "pathaoConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('json', { nullable: true }),
    __metadata("design:type", Object)
], SystemUser.prototype, "steadfastConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('json', { nullable: true }),
    __metadata("design:type", Object)
], SystemUser.prototype, "redxConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('json', { nullable: true }),
    __metadata("design:type", Object)
], SystemUser.prototype, "notificationConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('json', { nullable: true, default: [] }),
    __metadata("design:type", Array)
], SystemUser.prototype, "permissions", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: system_user_role_enum_1.SystemUserRole,
        default: system_user_role_enum_1.SystemUserRole.EMPLOYEE,
    }),
    __metadata("design:type", String)
], SystemUser.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], SystemUser.prototype, "resellerCommissionRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], SystemUser.prototype, "paidTotalEarning", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], SystemUser.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], SystemUser.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ nullable: true }),
    __metadata("design:type", Date)
], SystemUser.prototype, "deletedAt", void 0);
exports.SystemUser = SystemUser = __decorate([
    (0, typeorm_1.Entity)('system_users')
], SystemUser);
//# sourceMappingURL=systemuser.entity.js.map