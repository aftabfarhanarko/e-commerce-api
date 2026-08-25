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
exports.SettingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const setting_entity_1 = require("./entities/setting.entity");
let SettingService = class SettingService {
    constructor(settingRepo) {
        this.settingRepo = settingRepo;
    }
    create(createSettingDto) {
        const entity = this.settingRepo.create(createSettingDto);
        return this.settingRepo.save(entity);
    }
    async findAll() {
        return this.settingRepo.find();
    }
    async findFirstByCompanyId(companyId) {
        const entity = await this.settingRepo.findOne({
            where: { companyId },
            order: { id: 'ASC' },
        });
        if (!entity)
            throw new common_1.NotFoundException('No settings found');
        return entity;
    }
    async findFirst() {
        const entity = await this.settingRepo.findOne({
            where: {},
            order: { id: 'ASC' },
        });
        if (!entity)
            throw new common_1.NotFoundException('No settings found');
        return entity;
    }
    async upsertSmtp(companyId, dto) {
        let entity = null;
        try {
            entity = await this.settingRepo.findOne({
                where: { companyId },
                order: { id: 'ASC' },
            });
        }
        catch {
            entity = null;
        }
        if (!entity) {
            const smtpUser = dto.smtpUser?.trim() || '';
            const created = this.settingRepo.create({
                companyId,
                companyName: 'Default',
                email: smtpUser || 'noreply@example.com',
                smtpUser: smtpUser || null,
                smtpPass: dto.smtpPass ?? null,
            });
            return this.settingRepo.save(created);
        }
        const merged = this.settingRepo.merge(entity, {
            smtpUser: dto.smtpUser?.trim() || null,
            smtpPass: dto.smtpPass ?? null,
        });
        return this.settingRepo.save(merged);
    }
    async findOne(id) {
        const entity = await this.settingRepo.findOne({ where: { id } });
        if (!entity)
            throw new common_1.NotFoundException(`Setting ${id} not found`);
        return entity;
    }
    async update(id, updateSettingDto) {
        const entity = await this.findOne(id);
        const merged = this.settingRepo.merge(entity, updateSettingDto);
        return this.settingRepo.save(merged);
    }
    async remove(id) {
        const entity = await this.findOne(id);
        await this.settingRepo.softRemove(entity);
        return { success: true };
    }
    async upsertOrderReceiptUrl(companyId, dto) {
        let entity = null;
        try {
            entity = await this.settingRepo.findOne({
                where: { companyId },
                order: { id: 'ASC' },
            });
        }
        catch {
            entity = null;
        }
        if (!entity) {
            const created = this.settingRepo.create({
                companyId,
                companyName: 'Default',
                email: 'noreply@example.com',
                orderReceiptUrl: dto.orderReceiptUrl ?? null,
            });
            return this.settingRepo.save(created);
        }
        const merged = this.settingRepo.merge(entity, {
            orderReceiptUrl: dto.orderReceiptUrl ?? null,
        });
        return this.settingRepo.save(merged);
    }
    async getOrderReceiptUrl(companyId) {
        const entity = await this.settingRepo.findOne({
            where: { companyId },
            order: { id: 'ASC' },
        });
        return entity?.orderReceiptUrl ?? null;
    }
    async getFraudCheckerApiKey(companyId) {
        const entity = await this.settingRepo.findOne({
            where: { companyId },
            order: { id: 'ASC' },
        });
        return entity?.fraudCheckerApiKey ?? null;
    }
};
exports.SettingService = SettingService;
exports.SettingService = SettingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(setting_entity_1.Setting)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SettingService);
//# sourceMappingURL=setting.service.js.map