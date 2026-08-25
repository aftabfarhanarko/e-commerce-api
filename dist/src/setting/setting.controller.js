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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingController = void 0;
const common_1 = require("@nestjs/common");
const setting_service_1 = require("./setting.service");
const create_setting_dto_1 = require("./dto/create-setting.dto");
const update_setting_dto_1 = require("./dto/update-setting.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const company_id_guard_1 = require("../common/guards/company-id.guard");
const request_context_service_1 = require("../common/services/request-context.service");
const update_smtp_dto_1 = require("./dto/update-smtp.dto");
const update_order_receipt_url_dto_1 = require("./dto/update-order-receipt-url.dto");
let SettingController = class SettingController {
    constructor(settingService, requestContext) {
        this.settingService = settingService;
        this.requestContext = requestContext;
    }
    async create(createSettingDto) {
        const data = await this.settingService.create(createSettingDto);
        return { status: 'success', message: 'Setting created successfully', data };
    }
    async findAll() {
        const data = await this.settingService.findAll();
        return { status: 'success', message: 'Settings fetched successfully', data };
    }
    async upsertSmtp(dto) {
        const companyId = this.requestContext.getCompanyId();
        const data = await this.settingService.upsertSmtp(companyId, dto);
        return { status: 'success', message: 'SMTP updated successfully', data };
    }
    async upsertOrderReceiptUrl(dto) {
        const companyId = this.requestContext.getCompanyId();
        const data = await this.settingService.upsertOrderReceiptUrl(companyId, dto);
        return { status: 'success', message: 'Order receipt URL updated successfully', data };
    }
    async getOrderReceiptUrl() {
        const companyId = this.requestContext.getCompanyId();
        const url = await this.settingService.getOrderReceiptUrl(companyId);
        return { status: 'success', data: { orderReceiptUrl: url } };
    }
    async findOne(id) {
        const data = await this.settingService.findOne(+id);
        return { status: 'success', message: 'Setting fetched successfully', data };
    }
    async update(id, updateSettingDto) {
        const data = await this.settingService.update(+id, updateSettingDto);
        return { status: 'success', message: 'Setting updated successfully', data };
    }
    async remove(id) {
        await this.settingService.remove(+id);
        return { status: 'success', message: 'Setting removed successfully' };
    }
};
exports.SettingController = SettingController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_setting_dto_1.CreateSettingDto]),
    __metadata("design:returntype", Promise)
], SettingController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)('smtp'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_smtp_dto_1.UpdateSmtpDto]),
    __metadata("design:returntype", Promise)
], SettingController.prototype, "upsertSmtp", null);
__decorate([
    (0, common_1.Patch)('order-receipt-url'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_order_receipt_url_dto_1.UpdateOrderReceiptUrlDto]),
    __metadata("design:returntype", Promise)
], SettingController.prototype, "upsertOrderReceiptUrl", null);
__decorate([
    (0, common_1.Get)('order-receipt-url'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingController.prototype, "getOrderReceiptUrl", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_setting_dto_1.UpdateSettingDto]),
    __metadata("design:returntype", Promise)
], SettingController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SettingController.prototype, "remove", null);
exports.SettingController = SettingController = __decorate([
    (0, common_1.Controller)('setting'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, company_id_guard_1.CompanyIdGuard),
    __metadata("design:paramtypes", [setting_service_1.SettingService,
        request_context_service_1.RequestContextService])
], SettingController);
//# sourceMappingURL=setting.controller.js.map