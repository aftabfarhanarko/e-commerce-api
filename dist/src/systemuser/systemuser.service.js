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
exports.SystemuserService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const systemuser_entity_1 = require("./entities/systemuser.entity");
const package_entity_1 = require("../package/entities/package.entity");
const crypto = require("crypto");
const jwt_1 = require("@nestjs/jwt");
const company_id_service_1 = require("../common/services/company-id.service");
const email_templates_1 = require("./templates/email.templates");
const system_user_role_enum_1 = require("./system-user-role.enum");
const feature_permission_enum_1 = require("./feature-permission.enum");
const activity_log_service_1 = require("./activity-log.service");
const activity_log_entity_1 = require("./entities/activity-log.entity");
let SystemuserService = class SystemuserService {
    constructor(systemUserRepo, packageRepo, jwtService, companyIdService, activityLogService, configService, mailer) {
        this.systemUserRepo = systemUserRepo;
        this.packageRepo = packageRepo;
        this.jwtService = jwtService;
        this.companyIdService = companyIdService;
        this.activityLogService = activityLogService;
        this.configService = configService;
        this.mailer = mailer;
    }
    async onModuleInit() {
        try {
            await this.ensurePaidColumnsExist();
            console.log('✅ SystemUser missing paid columns check/fix executed successfully.');
        }
        catch (error) {
            console.error('❌ Failed to execute system user paid columns ensure check:', error);
        }
    }
    async findOneByCompanyId(companyId) {
        if (!companyId) {
            return null;
        }
        const user = await this.systemUserRepo.findOne({
            where: { companyId },
        });
        return user ?? null;
    }
    hashPassword(password, salt) {
        return crypto.createHmac('sha256', salt).update(password).digest('hex');
    }
    isMissingPaidColumnsError(error) {
        const err = error;
        if (err?.code !== '42703')
            return false;
        const msg = (err?.message || '').toLowerCase();
        return msg.includes('paidtotalearning');
    }
    async ensurePaidColumnsExist() {
        await this.systemUserRepo.query(`ALTER TABLE "system_users" ADD COLUMN IF NOT EXISTS "paidTotalEarning" numeric(12,2) NOT NULL DEFAULT 0`);
    }
    async sendUpdateEmail(user, newPassword) {
        try {
            const html = email_templates_1.EmailTemplates.getUserUpdateTemplate(user, newPassword);
            const displayCompany = user?.companyName;
            const subjectPrefix = displayCompany ? `${displayCompany} - ` : '';
            await this.mailer.sendMail({
                companyId: user.companyId,
                to: user.email,
                subject: `${subjectPrefix}Password Updated Successfully`,
                html,
            });
        }
        catch (error) {
            console.error('Failed to send update email:', error);
        }
    }
    async notifyAdminNewReseller(user) {
        try {
            const adminEmail = this.configService.get('RESELLER_ADMIN_EMAIL') ||
                'xinzo.shop@gmail.com';
            const companyLabel = user.companyName || user.companyId;
            const subjectPrefix = companyLabel ? `${companyLabel} - ` : '';
            const html = `
        <p>A new reseller account has been created or updated.</p>
        <p><strong>Name:</strong> ${user.name || ''}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Company:</strong> ${user.companyName || ''}</p>
        <p><strong>Company ID:</strong> ${user.companyId}</p>
        <p>You can review this user in the admin console and set their password / approval status.</p>
      `;
            await this.mailer.sendMail({
                companyId: user.companyId,
                to: adminEmail,
                subject: `${subjectPrefix}New reseller account pending approval`,
                html,
            });
        }
        catch (error) {
            console.error('Failed to send new reseller admin notification:', error);
        }
    }
    async sendWelcomeEmail(user, password) {
        try {
            const html = email_templates_1.EmailTemplates.getWelcomeEmailTemplate(user, password);
            const displayCompany = user?.companyName;
            const subjectPrefix = displayCompany ? `Welcome to ${displayCompany} - ` : 'Welcome - ';
            await this.mailer.sendMail({
                companyId: user.companyId,
                to: user.email,
                subject: `${subjectPrefix}Your Account Credentials`,
                html,
            });
        }
        catch (error) {
            console.error('Failed to send welcome email:', error);
        }
    }
    async sendInvoicePaidStoreReadyEmail(userId) {
        const user = await this.systemUserRepo.findOne({ where: { id: userId } });
        if (!user || !user.subdomain) {
            return;
        }
        const mainDomain = 'console.innowavecart.app';
        const subdomainUrl = `https://${user.subdomain}.${mainDomain}`;
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = this.hashPassword(tempPassword, salt);
        user.passwordSalt = salt;
        user.passwordHash = hash;
        await this.systemUserRepo.save(user);
        try {
            const html = email_templates_1.EmailTemplates.getInvoicePaidStoreReadyTemplate(user, tempPassword, subdomainUrl);
            const displayCompany = user?.companyName;
            const subjectPrefix = displayCompany ? `${displayCompany} - ` : '';
            await this.mailer.sendMail({
                companyId: user.companyId,
                to: user.email,
                subject: `${subjectPrefix}Your Store is Ready (Login & Subdomain)`,
                html,
            });
        }
        catch (error) {
            console.error('Failed to send invoice-paid store-ready email:', error);
        }
    }
    slugifyForSubdomain(input) {
        const base = (input || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        if (base.length === 0) {
            return `shop-${Date.now()}`;
        }
        return base;
    }
    async ensureProjectDomainForUser(userId) {
        const user = await this.systemUserRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('System user not found');
        }
        if (user.subdomain) {
            return {
                subdomain: user.subdomain,
                customDomain: user.customDomain,
                companyId: user.companyId,
            };
        }
        const seed = user.companyName ||
            user.companyId ||
            `shop-${user.id}`;
        const base = this.slugifyForSubdomain(seed);
        let candidate = base;
        let counter = 1;
        while (true) {
            const existing = await this.systemUserRepo.findOne({
                where: { subdomain: candidate },
            });
            if (!existing || existing.id === user.id) {
                break;
            }
            candidate = `${base}-${counter++}`;
        }
        user.subdomain = candidate;
        await this.systemUserRepo.save(user);
        return {
            subdomain: user.subdomain,
            customDomain: user.customDomain,
            companyId: user.companyId,
        };
    }
    async provisionSubdomainInRailway(userId) {
        const user = await this.systemUserRepo.findOne({ where: { id: userId } });
        if (!user || !user.subdomain) {
            return;
        }
        const mainDomain = this.configService.get('MAIN_DOMAIN') ||
            process.env.MAIN_DOMAIN ||
            'console.innowavecart.app';
        const fullSubdomain = `${user.subdomain}.${mainDomain}`;
        console.log(`✅ Subdomain "${fullSubdomain}" ready`);
        console.log('📋 Railway will route automatically via wildcard DNS');
        console.log('💡 Ensure wildcard DNS is configured: *.console.innowavecart.app → Railway service');
        console.log('💡 Railway will automatically provision SSL certificate');
    }
    async provisionCustomDomainInRailway(userId) {
        const user = await this.systemUserRepo.findOne({ where: { id: userId } });
        if (!user || !user.customDomain) {
            return;
        }
        const domain = user.customDomain.toLowerCase().trim();
        console.log(`📝 Custom domain saved: ${domain} (userId: ${userId}, companyId: ${user.companyId})`);
        console.log('📋 Super admin: Add this domain manually in Railway dashboard → Service → Settings → Domains → "+ Custom Domain"');
        console.log(`📋 Then configure CNAME (or A/ALIAS for root) as per Railway. SSL will auto-provision.`);
    }
    async markCustomDomainActive(userId) {
        const user = await this.systemUserRepo.findOne({ where: { id: userId } });
        if (!user || !user.customDomain) {
            return;
        }
        user.customDomainStatus = 'active';
        await this.systemUserRepo.save(user);
    }
    generateCustomDomainVerificationToken() {
        return crypto.randomBytes(16).toString('hex');
    }
    normalizeCustomDomain(domain) {
        let d = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
        if (d.startsWith('www.')) {
            d = d.slice(4);
        }
        return d;
    }
    async findPendingDnsDomains() {
        return this.systemUserRepo.find({
            where: { customDomainStatus: 'pending_dns' },
            select: ['id', 'companyId', 'customDomain', 'customDomainVerificationCode'],
        });
    }
    async findSslProvisioningDomains() {
        return this.systemUserRepo.find({
            where: { customDomainStatus: 'ssl_provisioning' },
            select: ['id', 'companyId', 'customDomain', 'cloudflareHostnameId'],
        });
    }
    async setCustomDomainVerified(userId) {
        await this.systemUserRepo.update({ id: userId }, {
            customDomainStatus: 'verified',
            customDomainVerifiedAt: new Date(),
        });
    }
    async setCustomDomainSslProvisioning(userId, cloudflareHostnameId) {
        await this.systemUserRepo.update({ id: userId }, {
            customDomainStatus: 'ssl_provisioning',
            ...(cloudflareHostnameId != null && { cloudflareHostnameId }),
        });
    }
    async setCustomDomainActive(userId) {
        await this.systemUserRepo.update({ id: userId }, {
            customDomainStatus: 'active',
            sslProvisionedAt: new Date(),
        });
    }
    async setCustomDomainFailed(userId) {
        await this.systemUserRepo.update({ id: userId }, { customDomainStatus: 'failed' });
    }
    async setCloudflareHostnameId(userId, hostnameId) {
        await this.systemUserRepo.update({ id: userId }, { cloudflareHostnameId: hostnameId });
    }
    async create(dto, creatorCompanyId, creatorRole, performedByUserId) {
        const exists = await this.systemUserRepo.findOne({ where: { email: dto.email } });
        if (exists)
            throw new common_1.BadRequestException('Email already exists');
        let role = dto.role;
        if (!role) {
            if (creatorRole === system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER) {
                role = system_user_role_enum_1.SystemUserRole.EMPLOYEE;
            }
            else {
                role = system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER;
            }
        }
        if (role === system_user_role_enum_1.SystemUserRole.SUPER_ADMIN) {
            throw new common_1.BadRequestException('Cannot create SUPER_ADMIN role');
        }
        if (role === system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER) {
            const normalizedCreatorRole = creatorRole;
            if (normalizedCreatorRole &&
                normalizedCreatorRole !== system_user_role_enum_1.SystemUserRole.SUPER_ADMIN &&
                normalizedCreatorRole !== 'SUPER_ADMIN' &&
                normalizedCreatorRole !== system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER) {
                throw new common_1.BadRequestException('Only Super Admin or System Owner can create System Owner');
            }
        }
        const dtoCompanyId = dto.companyId;
        let companyId;
        if (role === system_user_role_enum_1.SystemUserRole.RESELLER && dtoCompanyId && typeof dtoCompanyId === 'string') {
            companyId = dtoCompanyId.trim();
        }
        else {
            companyId = creatorCompanyId || (await this.companyIdService.generateNextCompanyId());
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = this.hashPassword(dto.password, salt);
        let permissions = dto.permissions || [];
        if (role === system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER) {
            if (!permissions.includes(feature_permission_enum_1.FeaturePermission.MANAGE_USERS)) {
                permissions = [...permissions, feature_permission_enum_1.FeaturePermission.MANAGE_USERS];
            }
            if (!permissions.includes(feature_permission_enum_1.FeaturePermission.STAFF)) {
                permissions = [...permissions, feature_permission_enum_1.FeaturePermission.STAFF];
            }
        }
        if (dto.packageId) {
            const packageEntity = await this.packageRepo.findOne({
                where: { id: dto.packageId }
            });
            if (packageEntity && packageEntity.features && Array.isArray(packageEntity.features)) {
                const packageFeatures = packageEntity.features;
                const mergedPermissions = [...new Set([...packageFeatures, ...permissions])];
                if (role === system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER) {
                    if (!mergedPermissions.includes(feature_permission_enum_1.FeaturePermission.MANAGE_USERS)) {
                        mergedPermissions.push(feature_permission_enum_1.FeaturePermission.MANAGE_USERS);
                    }
                    if (!mergedPermissions.includes(feature_permission_enum_1.FeaturePermission.STAFF)) {
                        mergedPermissions.push(feature_permission_enum_1.FeaturePermission.STAFF);
                    }
                }
                permissions = mergedPermissions;
            }
        }
        const entity = this.systemUserRepo.create({
            name: dto.name,
            email: dto.email,
            companyName: dto.companyName,
            companyId,
            companyLogo: dto.companyLogo ?? null,
            phone: dto.phone ?? null,
            branchLocation: dto.branchLocation ?? null,
            primaryColor: dto.primaryColor ?? undefined,
            secondaryColor: dto.secondaryColor ?? undefined,
            passwordSalt: salt,
            passwordHash: hash,
            isActive: true,
            paymentInfo: dto.paymentInfo ?? null,
            packageId: dto.packageId ?? null,
            themeId: dto.themeId ?? null,
            permissions,
            role,
            resellerCommissionRate: dto.resellerCommissionRate != null
                ? dto.resellerCommissionRate
                : null,
        });
        await this.systemUserRepo.save(entity);
        const createdUser = await this.systemUserRepo.findOne({
            where: { email: dto.email },
            relations: ['package', 'theme', 'invoices'],
        });
        if (performedByUserId && createdUser) {
            try {
                await this.activityLogService.logActivity({
                    companyId: createdUser.companyId,
                    action: activity_log_entity_1.ActivityAction.CREATE,
                    entity: activity_log_entity_1.ActivityEntity.SYSTEM_USER,
                    entityId: createdUser.id,
                    entityName: createdUser.name || createdUser.email,
                    description: `Created system user: ${createdUser.name} (${createdUser.email})`,
                    newValues: {
                        name: createdUser.name,
                        email: createdUser.email,
                        role: createdUser.role,
                    },
                    performedByUserId,
                    targetUserId: createdUser.id,
                });
            }
            catch (error) {
                console.error('Failed to log activity:', error);
            }
        }
        if (role === system_user_role_enum_1.SystemUserRole.EMPLOYEE && creatorRole === system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER && createdUser) {
            await this.sendWelcomeEmail(createdUser, dto.password);
        }
        if (role === system_user_role_enum_1.SystemUserRole.RESELLER && createdUser) {
            await this.notifyAdminNewReseller(createdUser);
        }
        const { passwordHash, passwordSalt, ...safe } = createdUser;
        return safe;
    }
    async findAll(companyId) {
        const whereCondition = companyId ? { companyId } : {};
        let list;
        try {
            list = await this.systemUserRepo.find({
                where: whereCondition,
                order: { id: 'DESC' },
                relations: ['package', 'theme', 'invoices'],
            });
        }
        catch (error) {
            if (!this.isMissingPaidColumnsError(error)) {
                throw error;
            }
            await this.ensurePaidColumnsExist();
            list = await this.systemUserRepo.find({
                where: whereCondition,
                order: { id: 'DESC' },
                relations: ['package', 'theme', 'invoices'],
            });
        }
        return list.map(({ passwordHash, passwordSalt, ...safe }) => safe);
    }
    async findOne(id, companyId) {
        if (!id || isNaN(Number(id))) {
            throw new common_1.NotFoundException('Invalid user ID');
        }
        const whereCondition = { id: Number(id) };
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        const entity = await this.systemUserRepo.findOne({
            where: whereCondition,
            relations: ['package', 'theme', 'invoices'],
        });
        if (!entity)
            throw new common_1.NotFoundException('System user not found');
        const { passwordHash, passwordSalt, ...safe } = entity;
        return safe;
    }
    async update(id, dto, companyId, performedByUserId) {
        const whereCondition = { id };
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        const entity = await this.systemUserRepo.findOne({ where: whereCondition });
        if (!entity)
            throw new common_1.NotFoundException('System user not found');
        const previousRole = entity.role;
        const previousIsActive = entity.isActive;
        let passwordUpdated = false;
        let newPassword;
        if (dto.email && dto.email !== entity.email) {
            const exists = await this.systemUserRepo.findOne({ where: { email: dto.email } });
            if (exists)
                throw new common_1.BadRequestException('Email already exists');
            entity.email = dto.email;
        }
        if (dto.name !== undefined)
            entity.name = dto.name;
        if (dto.companyName !== undefined) {
            entity.companyName = dto.companyName;
        }
        if (dto.subdomain !== undefined) {
            if (dto.subdomain !== entity.subdomain) {
                throw new common_1.BadRequestException('Subdomain is managed automatically after the first successful payment and cannot be changed manually');
            }
        }
        if (dto.subdomainEnabled !== undefined) {
            entity.subdomainEnabled = Boolean(dto.subdomainEnabled);
        }
        if (dto.customDomain !== undefined) {
            const rawDomain = dto.customDomain;
            if (rawDomain) {
                const newDomain = this.normalizeCustomDomain(rawDomain);
                if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(newDomain)) {
                    throw new common_1.BadRequestException('Invalid domain format');
                }
                const existing = await this.systemUserRepo.findOne({ where: { customDomain: newDomain } });
                if (existing && existing.id !== id) {
                    throw new common_1.BadRequestException('This domain is already in use by another store');
                }
                entity.customDomain = newDomain;
                entity.customDomainStatus = 'pending_dns';
                entity.customDomainVerificationCode = this.generateCustomDomainVerificationToken();
                entity.customDomainVerifiedAt = null;
                entity.sslProvisionedAt = null;
                entity.cloudflareHostnameId = null;
            }
            else {
                entity.customDomain = null;
                entity.customDomainStatus = 'pending_dns';
                entity.customDomainVerificationCode = null;
                entity.customDomainVerifiedAt = null;
                entity.sslProvisionedAt = null;
                entity.cloudflareHostnameId = null;
            }
        }
        if (dto.companyLogo !== undefined) {
            entity.companyLogo = dto.companyLogo;
        }
        if (dto.phone !== undefined) {
            entity.phone = dto.phone;
        }
        if (dto.branchLocation !== undefined) {
            entity.branchLocation = dto.branchLocation;
        }
        if (dto.primaryColor !== undefined) {
            entity.primaryColor = dto.primaryColor;
        }
        if (dto.secondaryColor !== undefined) {
            entity.secondaryColor = dto.secondaryColor;
        }
        if (dto.pathaoConfig !== undefined) {
            entity.pathaoConfig = dto.pathaoConfig;
        }
        if (dto.steadfastConfig !== undefined) {
            entity.steadfastConfig = dto.steadfastConfig;
        }
        if (dto.redxConfig !== undefined) {
            entity.redxConfig = dto.redxConfig;
        }
        if (dto.notificationConfig !== undefined) {
            entity.notificationConfig = dto.notificationConfig;
        }
        if (dto.password) {
            const salt = crypto.randomBytes(16).toString('hex');
            const hash = this.hashPassword(dto.password, salt);
            entity.passwordSalt = salt;
            entity.passwordHash = hash;
            passwordUpdated = true;
            newPassword = dto.password;
        }
        if (dto.paymentInfo !== undefined) {
            entity.paymentInfo = dto.paymentInfo;
        }
        if (dto.resellerCommissionRate !== undefined) {
            entity.resellerCommissionRate =
                dto.resellerCommissionRate != null
                    ? dto.resellerCommissionRate
                    : null;
        }
        if (dto.packageId !== undefined) {
            const newPackageId = dto.packageId;
            const currentPackageId = entity.packageId ?? entity.packageId;
            if (newPackageId != null && currentPackageId != null && Number(newPackageId) !== Number(currentPackageId)) {
                entity.previousPackageId = currentPackageId;
            }
            entity.packageId = newPackageId;
            if (dto.packageId) {
                const packageEntity = await this.packageRepo.findOne({
                    where: { id: dto.packageId }
                });
                if (packageEntity && packageEntity.features && Array.isArray(packageEntity.features)) {
                    const packageFeatures = packageEntity.features;
                    if (entity.role === system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER) {
                        const mergedPermissions = [...new Set([...packageFeatures])];
                        if (!mergedPermissions.includes(feature_permission_enum_1.FeaturePermission.MANAGE_USERS)) {
                            mergedPermissions.push(feature_permission_enum_1.FeaturePermission.MANAGE_USERS);
                        }
                        if (!mergedPermissions.includes(feature_permission_enum_1.FeaturePermission.STAFF)) {
                            mergedPermissions.push(feature_permission_enum_1.FeaturePermission.STAFF);
                        }
                        entity.permissions = mergedPermissions;
                    }
                    else {
                        const existingPermissions = entity.permissions || [];
                        const validPermissions = existingPermissions.filter(p => packageFeatures.includes(p));
                        entity.permissions = validPermissions;
                    }
                }
            }
            else if (dto.packageId === null) {
                if (entity.role === system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER) {
                    entity.permissions = [feature_permission_enum_1.FeaturePermission.MANAGE_USERS, feature_permission_enum_1.FeaturePermission.STAFF];
                }
                else {
                    entity.permissions = [];
                }
            }
        }
        if (dto.themeId !== undefined) {
            entity.themeId = dto.themeId;
        }
        if (dto.permissions !== undefined) {
            entity.permissions = dto.permissions || [];
        }
        if (dto.role !== undefined) {
            if (dto.role === system_user_role_enum_1.SystemUserRole.SUPER_ADMIN) {
                throw new common_1.BadRequestException('Cannot change role to SUPER_ADMIN');
            }
            entity.role = dto.role;
        }
        if (dto.isActive !== undefined) {
            entity.isActive = dto.isActive;
        }
        const oldValues = {
            name: entity.name,
            email: entity.email,
            phone: entity.phone,
            isActive: entity.isActive,
            role: entity.role,
        };
        await this.systemUserRepo.save(entity);
        const updatedUser = await this.systemUserRepo.findOne({
            where: { id },
            relations: ['package', 'theme', 'invoices'],
        });
        if (passwordUpdated && newPassword) {
            await this.sendUpdateEmail(updatedUser, newPassword);
        }
        if (previousRole !== system_user_role_enum_1.SystemUserRole.RESELLER &&
            updatedUser.role === system_user_role_enum_1.SystemUserRole.RESELLER) {
            await this.notifyAdminNewReseller(updatedUser);
        }
        if (!previousIsActive && updatedUser?.isActive && updatedUser.email) {
            try {
                const displayCompany = updatedUser?.companyName;
                const subjectPrefix = displayCompany ? `${displayCompany} - ` : '';
                const subject = `${subjectPrefix}Your account is now active`;
                const greetingName = updatedUser.name || updatedUser.email;
                const loginUrl = this.configService.get('RESELLER_LOGIN_URL') ||
                    'https://www.fiberace.shop';
                const html = `
          <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f4f4f5; padding: 24px;">
            <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px 24px 20px; box-shadow: 0 10px 30px rgba(15,23,42,0.12);">
              <div style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #111111; font-weight: 600; margin-bottom: 6px;">
                Account activated
              </div>
              <h1 style="margin: 0 0 12px; font-size: 20px; line-height: 1.3; color: #0f172a;">
                Hi ${greetingName},
              </h1>
              <p style="margin: 0 0 8px; font-size: 14px; color: #4b5563;">
                আপনার একাউন্টটি <strong>সফলভাবে অ্যাক্টিভ</strong> করা হয়েছে। এখন আপনি লগইন করে আপনার ড্যাশবোর্ড ব্যবহার করতে পারবেন।
              </p>
              <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">
                You can now sign in to your dashboard using your email address. If you don&apos;t remember your password, please use the &quot;Forgot password&quot; option on the login page.
              </p>

              <div style="margin: 18px 0 20px; text-align: center;">
                <a href="${loginUrl}" style="display: inline-block; padding: 10px 20px; border-radius: 999px; background: linear-gradient(90deg,#ffffff,#111111); color: #000000; font-size: 14px; font-weight: 600; text-decoration: none;">
                  Go to dashboard
                </a>
              </div>

              <div style="border-top: 1px solid #e5e7eb; margin-top: 16px; padding-top: 12px;">
                <p style="margin: 0 0 4px; font-size: 11px; color: #9ca3af;">
                  Login URL: <a href="${loginUrl}" style="color: #000000; text-decoration: underline;">${loginUrl}</a>
                </p>
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                  If you did not expect this email, you can ignore it.
                </p>
              </div>
            </div>
          </div>
        `;
                await this.mailer.sendMail({
                    companyId: updatedUser.companyId,
                    to: updatedUser.email,
                    subject,
                    html,
                });
            }
            catch (error) {
                console.error('Failed to send system user activation email:', error);
            }
        }
        if (performedByUserId && updatedUser) {
            try {
                const newValues = {
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    isActive: updatedUser.isActive,
                    role: updatedUser.role,
                };
                if (passwordUpdated) {
                    newValues.passwordChanged = true;
                }
                await this.activityLogService.logActivity({
                    companyId: updatedUser.companyId,
                    action: activity_log_entity_1.ActivityAction.UPDATE,
                    entity: activity_log_entity_1.ActivityEntity.SYSTEM_USER,
                    entityId: updatedUser.id,
                    entityName: updatedUser.name || updatedUser.email,
                    description: `Updated system user: ${updatedUser.name} (${updatedUser.email})`,
                    oldValues,
                    newValues,
                    performedByUserId,
                    targetUserId: updatedUser.id,
                });
            }
            catch (error) {
                console.error('Failed to log activity:', error);
            }
        }
        const { passwordHash, passwordSalt, ...safe } = updatedUser;
        return safe;
    }
    async revertToPreviousPackage(id, companyId, performedByUserId) {
        const whereCondition = { id };
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        const entity = await this.systemUserRepo.findOne({ where: whereCondition });
        if (!entity)
            throw new common_1.NotFoundException('System user not found');
        const previousId = entity.previousPackageId;
        if (previousId == null) {
            throw new common_1.BadRequestException('No previous package to revert to');
        }
        const currentPackageId = entity.packageId ?? entity.packageId;
        entity.packageId = previousId;
        entity.previousPackageId = null;
        const packageEntity = await this.packageRepo.findOne({ where: { id: previousId } });
        if (packageEntity?.features && Array.isArray(packageEntity.features)) {
            const packageFeatures = packageEntity.features;
            if (entity.role === system_user_role_enum_1.SystemUserRole.SYSTEM_OWNER) {
                const merged = [...new Set([...packageFeatures])];
                if (!merged.includes(feature_permission_enum_1.FeaturePermission.MANAGE_USERS))
                    merged.push(feature_permission_enum_1.FeaturePermission.MANAGE_USERS);
                if (!merged.includes(feature_permission_enum_1.FeaturePermission.STAFF))
                    merged.push(feature_permission_enum_1.FeaturePermission.STAFF);
                entity.permissions = merged;
            }
            else {
                const existing = entity.permissions || [];
                entity.permissions = existing.filter((p) => packageFeatures.includes(p));
            }
        }
        await this.systemUserRepo.save(entity);
        const updatedUser = await this.systemUserRepo.findOne({
            where: { id },
            relations: ['package', 'theme', 'invoices'],
        });
        if (performedByUserId && updatedUser) {
            try {
                await this.activityLogService.logActivity({
                    companyId: updatedUser.companyId,
                    action: activity_log_entity_1.ActivityAction.UPDATE,
                    entity: activity_log_entity_1.ActivityEntity.SYSTEM_USER,
                    entityId: updatedUser.id,
                    entityName: updatedUser.name || updatedUser.email,
                    description: `Reverted package to previous (fallback)`,
                    oldValues: { packageId: currentPackageId },
                    newValues: { packageId: previousId },
                    performedByUserId,
                    targetUserId: updatedUser.id,
                });
            }
            catch (e) {
                console.error('Failed to log activity:', e);
            }
        }
        const { passwordHash, passwordSalt, ...safe } = updatedUser;
        return safe;
    }
    async remove(id, companyId, performedByUserId) {
        const whereCondition = { id };
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        const entity = await this.systemUserRepo.findOne({ where: whereCondition });
        if (!entity)
            throw new common_1.NotFoundException('System user not found');
        if (performedByUserId) {
            try {
                await this.activityLogService.logActivity({
                    companyId: entity.companyId,
                    action: activity_log_entity_1.ActivityAction.DELETE,
                    entity: activity_log_entity_1.ActivityEntity.SYSTEM_USER,
                    entityId: entity.id,
                    entityName: entity.name || entity.email,
                    description: `Deleted system user: ${entity.name} (${entity.email})`,
                    oldValues: {
                        name: entity.name,
                        email: entity.email,
                        role: entity.role,
                    },
                    performedByUserId,
                    targetUserId: entity.id,
                });
            }
            catch (error) {
                console.error('Failed to log activity:', error);
            }
        }
        await this.systemUserRepo.softRemove(entity);
        return { success: true };
    }
    async listTrashed(companyId) {
        const qb = this.systemUserRepo
            .createQueryBuilder('user')
            .withDeleted()
            .leftJoinAndSelect('user.package', 'package')
            .leftJoinAndSelect('user.theme', 'theme')
            .leftJoinAndSelect('user.invoices', 'invoices')
            .where('user.deletedAt IS NOT NULL')
            .orderBy('user.deletedAt', 'DESC');
        if (companyId) {
            qb.andWhere('user.companyId = :companyId', { companyId });
        }
        const list = await qb.getMany();
        return list.map(({ passwordHash, passwordSalt, ...safe }) => safe);
    }
    async restore(id, companyId, performedByUserId) {
        const whereCondition = { id };
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        const entity = await this.systemUserRepo.findOne({
            where: whereCondition,
            withDeleted: true,
            relations: ['package', 'theme', 'invoices'],
        });
        if (!entity)
            throw new common_1.NotFoundException('System user not found');
        if (!entity.deletedAt) {
            const { passwordHash, passwordSalt, ...safe } = entity;
            return safe;
        }
        await this.systemUserRepo.recover(entity);
        const restored = await this.systemUserRepo.findOne({
            where: { id: entity.id },
            relations: ['package', 'theme', 'invoices'],
        });
        if (!restored)
            throw new common_1.NotFoundException('System user not found after restore');
        if (performedByUserId) {
            try {
                await this.activityLogService.logActivity({
                    companyId: restored.companyId,
                    action: activity_log_entity_1.ActivityAction.UPDATE,
                    entity: activity_log_entity_1.ActivityEntity.SYSTEM_USER,
                    entityId: restored.id,
                    entityName: restored.name || restored.email,
                    description: `Restored system user: ${restored.name} (${restored.email})`,
                    oldValues: { deletedAt: entity.deletedAt },
                    newValues: { deletedAt: null },
                    performedByUserId,
                    targetUserId: restored.id,
                });
            }
            catch (error) {
                console.error('Failed to log activity:', error);
            }
        }
        const { passwordHash, passwordSalt, ...safe } = restored;
        return safe;
    }
    async permanentDelete(id, companyId, performedByUserId) {
        const whereCondition = { id };
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        const entity = await this.systemUserRepo.findOne({
            where: whereCondition,
            withDeleted: true,
        });
        if (!entity)
            throw new common_1.NotFoundException('System user not found in trash');
        if (!entity.deletedAt) {
            throw new common_1.BadRequestException('System user is not in trash');
        }
        if (performedByUserId) {
            try {
                await this.activityLogService.logActivity({
                    companyId: entity.companyId,
                    action: activity_log_entity_1.ActivityAction.DELETE,
                    entity: activity_log_entity_1.ActivityEntity.SYSTEM_USER,
                    entityId: entity.id,
                    entityName: entity.name || entity.email,
                    description: `Permanently deleted system user: ${entity.name} (${entity.email})`,
                    oldValues: { deletedAt: entity.deletedAt },
                    newValues: { deletedAt: null },
                    performedByUserId,
                    targetUserId: entity.id,
                });
            }
            catch (error) {
                console.error('Failed to log activity:', error);
            }
        }
        await this.systemUserRepo.remove(entity);
        return { success: true };
    }
    async login(dto) {
        const user = await this.systemUserRepo.findOne({
            where: { email: dto.email },
            relations: ['package', 'theme', 'invoices'],
        });
        if (!user)
            throw new common_1.NotFoundException('Invalid credentials');
        if (!dto.password) {
            throw new common_1.BadRequestException('Password is required');
        }
        if (!user.passwordSalt || !user.passwordHash) {
            throw new common_1.NotFoundException('Invalid credentials');
        }
        const hash = this.hashPassword(dto.password, user.passwordSalt);
        if (hash !== user.passwordHash)
            throw new common_1.NotFoundException('Invalid credentials');
        if (!user.isActive && user.role === system_user_role_enum_1.SystemUserRole.RESELLER) {
            throw new common_1.BadRequestException('Your reseller account is inactive. Please clear pending payments and contact the admin.');
        }
        const payload = {
            sub: user.id,
            userId: user.id,
            email: user.email,
            companyId: user.companyId,
            paymentInfo: user.paymentInfo ?? null,
            packageId: user.packageId ?? null,
            package: user.package ?? null,
            themeId: user.themeId ?? null,
            theme: user.theme ?? null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            isActive: user.isActive,
            companyName: user.companyName,
            companyLogo: user.companyLogo,
            phone: user.phone,
            branchLocation: user.branchLocation,
            name: user.name,
            invoices: user.invoices ?? null,
            permissions: user.permissions || [],
            role: user.role || system_user_role_enum_1.SystemUserRole.EMPLOYEE,
        };
        const accessToken = this.jwtService.sign(payload, { expiresIn: '24d' });
        const refreshToken = this.jwtService.sign({ sub: user.id, userId: user.id }, { expiresIn: '24d' });
        const { passwordHash, passwordSalt, ...safe } = user;
        return { accessToken, refreshToken, user: safe };
    }
    async refreshToken(refreshToken) {
        const payload = this.jwtService.verify(refreshToken);
        const userId = payload?.sub ?? payload?.userId;
        if (!userId) {
            throw new common_1.BadRequestException('Invalid refresh token');
        }
        const user = await this.systemUserRepo.findOne({
            where: { id: userId },
            relations: ['package', 'theme', 'invoices'],
        });
        if (!user || !user.isActive) {
            throw new common_1.BadRequestException('User not found or inactive');
        }
        const tokenPayload = {
            sub: user.id,
            userId: user.id,
            email: user.email,
            companyId: user.companyId,
            paymentInfo: user.paymentInfo ?? null,
            packageId: user.packageId ?? null,
            package: user.package ?? null,
            themeId: user.themeId ?? null,
            theme: user.theme ?? null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            isActive: user.isActive,
            companyName: user.companyName,
            companyLogo: user.companyLogo,
            phone: user.phone,
            branchLocation: user.branchLocation,
            name: user.name,
            invoices: user.invoices ?? null,
            permissions: user.permissions || [],
            role: user.role || system_user_role_enum_1.SystemUserRole.EMPLOYEE,
        };
        const accessToken = this.jwtService.sign(tokenPayload, { expiresIn: '24d' });
        const newRefreshToken = this.jwtService.sign({ sub: user.id, userId: user.id }, { expiresIn: '24d' });
        return { accessToken, refreshToken: newRefreshToken };
    }
    async forgotPassword(dto) {
        const user = await this.systemUserRepo.findOne({
            where: { email: dto.email }
        });
        if (!user) {
            return {
                success: true,
                message: 'If the email exists, a password reset link has been sent.'
            };
        }
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetTokenExpiry = new Date();
        resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = resetTokenExpiry;
        await this.systemUserRepo.save(user);
        const frontendUrl = 'https://www.fiberace.shop';
        const resetLink = `${frontendUrl}/reset-password?id=${user.id}&token=${resetToken}`;
        try {
            const html = email_templates_1.EmailTemplates.getPasswordResetTemplate(user, resetLink);
            const displayCompany = user?.companyName;
            const subjectPrefix = displayCompany ? `${displayCompany} - ` : '';
            await this.mailer.sendMail({
                companyId: user.companyId,
                to: user.email,
                subject: `${subjectPrefix}Password Reset Request`,
                html,
            });
            return {
                success: true,
                message: 'Password reset link has been sent to your email.'
            };
        }
        catch (error) {
            console.error('Failed to send password reset email:', error);
            throw new common_1.BadRequestException('Failed to send password reset email. Please try again later.');
        }
    }
    async resetPassword(userId, token, dto) {
        if (dto.password !== dto.confirmPassword) {
            throw new common_1.BadRequestException('Passwords do not match');
        }
        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const user = await this.systemUserRepo.findOne({
            where: {
                id: userId,
                resetPasswordToken: resetTokenHash
            }
        });
        if (!user) {
            throw new common_1.BadRequestException('Invalid or expired reset token');
        }
        if (user.resetPasswordExpires < new Date()) {
            throw new common_1.BadRequestException('Reset token has expired. Please request a new one.');
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = this.hashPassword(dto.password, salt);
        user.passwordSalt = salt;
        user.passwordHash = hash;
        user.resetPasswordToken = '';
        user.resetPasswordExpires = new Date();
        await this.systemUserRepo.save(user);
        return {
            success: true,
            message: 'Password has been reset successfully. You can now login with your new password.'
        };
    }
    async assignPermissions(userId, permissions, companyId, assignerPermissions, performedByUserId) {
        const whereCondition = { id: userId };
        if (companyId) {
            whereCondition.companyId = companyId;
        }
        const entity = await this.systemUserRepo.findOne({
            where: whereCondition,
            relations: ['package'],
        });
        if (!entity)
            throw new common_1.NotFoundException('System user not found');
        if (assignerPermissions && assignerPermissions.length > 0) {
            const invalidPermissions = permissions.filter(p => !assignerPermissions.includes(p));
            if (invalidPermissions.length > 0) {
                throw new common_1.BadRequestException(`Cannot assign permissions you don't have: ${invalidPermissions.join(', ')}`);
            }
        }
        if (entity.role === system_user_role_enum_1.SystemUserRole.EMPLOYEE && entity.package) {
            const packageFeatures = entity.package.features || [];
            const validPermissions = permissions.filter(p => packageFeatures.includes(p));
            entity.permissions = validPermissions;
        }
        else {
            entity.permissions = permissions;
        }
        const oldPermissions = entity.permissions || [];
        await this.systemUserRepo.save(entity);
        if (performedByUserId) {
            try {
                await this.activityLogService.logActivity({
                    companyId: entity.companyId,
                    action: activity_log_entity_1.ActivityAction.PERMISSION_ASSIGN,
                    entity: activity_log_entity_1.ActivityEntity.SYSTEM_USER,
                    entityId: entity.id,
                    entityName: entity.name || entity.email,
                    description: `Assigned permissions to ${entity.name} (${entity.email})`,
                    oldValues: { permissions: oldPermissions },
                    newValues: { permissions: entity.permissions || [] },
                    performedByUserId,
                    targetUserId: entity.id,
                });
            }
            catch (error) {
                console.error('Failed to log activity:', error);
            }
        }
        const { passwordHash, passwordSalt, ...safe } = entity;
        return {
            statusCode: 200,
            message: 'Permissions assigned successfully',
            data: safe,
        };
    }
};
exports.SystemuserService = SystemuserService;
exports.SystemuserService = SystemuserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(systemuser_entity_1.SystemUser)),
    __param(1, (0, typeorm_1.InjectRepository)(package_entity_1.Package)),
    __param(6, (0, common_1.Inject)('MAILER_TRANSPORT')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        company_id_service_1.CompanyIdService,
        activity_log_service_1.ActivityLogService,
        config_1.ConfigService, Object])
], SystemuserService);
//# sourceMappingURL=systemuser.service.js.map