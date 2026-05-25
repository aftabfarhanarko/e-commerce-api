import { Injectable, BadRequestException, NotFoundException, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateSystemuserDto } from './dto/create-systemuser.dto';
import { UpdateSystemuserDto } from './dto/update-systemuser.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemUser } from './entities/systemuser.entity';
import { Package } from '../package/entities/package.entity';

import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { CompanyIdService } from '../common/services/company-id.service';
import { EmailTemplates } from './templates/email.templates';
import { SystemUserRole } from './system-user-role.enum';
import { FeaturePermission } from './feature-permission.enum';
import { ActivityLogService } from './activity-log.service';
import { ActivityAction, ActivityEntity } from './entities/activity-log.entity';
import type { CustomDomainStatus } from './custom-domain-status.enum';

@Injectable()
export class SystemuserService implements OnModuleInit {
  constructor(
    @InjectRepository(SystemUser)
    private readonly systemUserRepo: Repository<SystemUser>,
    @InjectRepository(Package)
    private readonly packageRepo: Repository<Package>,
    private readonly jwtService: JwtService,
    private readonly companyIdService: CompanyIdService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
    @Inject('MAILER_TRANSPORT')
    private readonly mailer: { sendMail: (message: any) => Promise<{ id?: string }> },
  ) { }

  async onModuleInit() {
    try {
      await this.ensurePaidColumnsExist();
      console.log('✅ SystemUser missing paid columns check/fix executed successfully.');
    } catch (error) {
      console.error('❌ Failed to execute system user paid columns ensure check:', error);
    }
  }

  /**
   * Helper for other modules (e.g. Orders) to resolve a tenant/company
   * by its companyId and use its branding (companyName, logo, etc.).
   */
  async findOneByCompanyId(companyId: string): Promise<SystemUser | null> {
    if (!companyId) {
      return null;
    }
    const user = await this.systemUserRepo.findOne({
      where: { companyId },
    });
    return user ?? null;
  }
  

  private hashPassword(password: string, salt: string): string {
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
  }

  private isMissingPaidColumnsError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };
    if (err?.code !== '42703') return false;
    const msg = (err?.message || '').toLowerCase();
    return msg.includes('paidtotalsoldqty') || msg.includes('paidtotalearning');
  }

  private async ensurePaidColumnsExist(): Promise<void> {
    await this.systemUserRepo.query(
      `ALTER TABLE "system_users" ADD COLUMN IF NOT EXISTS "paidTotalSoldQty" integer NOT NULL DEFAULT 0`,
    );
    await this.systemUserRepo.query(
      `ALTER TABLE "system_users" ADD COLUMN IF NOT EXISTS "paidTotalEarning" numeric(12,2) NOT NULL DEFAULT 0`,
    );
  }

  private async sendUpdateEmail(user: any, newPassword?: string) {
    try {
      const html = EmailTemplates.getUserUpdateTemplate(user, newPassword);
      const displayCompany: string | undefined = (user as any)?.companyName;
      const subjectPrefix = displayCompany ? `${displayCompany} - ` : '';

      await this.mailer.sendMail({
        companyId: user.companyId,
        to: user.email,
        subject: `${subjectPrefix}Password Updated Successfully`,
        html,
      });
    } catch (error) {
      console.error('Failed to send update email:', error);
      // Don't throw error - email failure shouldn't stop user update
    }
  }

  private async notifyAdminNewReseller(user: SystemUser) {
    try {
      const adminEmail =
        this.configService.get<string>('RESELLER_ADMIN_EMAIL') ||
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
    } catch (error) {
      console.error('Failed to send new reseller admin notification:', error);
      // Do not throw – creation/update should still succeed
    }
  }

  private async sendWelcomeEmail(user: any, password: string) {
    try {
      const html = EmailTemplates.getWelcomeEmailTemplate(user, password);
      const displayCompany: string | undefined = (user as any)?.companyName;
      const subjectPrefix = displayCompany ? `Welcome to ${displayCompany} - ` : 'Welcome - ';

      await this.mailer.sendMail({
        companyId: user.companyId,
        to: user.email,
        subject: `${subjectPrefix}Your Account Credentials`,
        html,
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't throw error - email failure shouldn't stop user creation
    }
  }

  /**
   * When invoice is paid and subdomain is created: set a temporary password for the user
   * and send one email with Email, Password, and Subdomain URL.
   */
  async sendInvoicePaidStoreReadyEmail(userId: number): Promise<void> {
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
      const html = EmailTemplates.getInvoicePaidStoreReadyTemplate(
        user,
        tempPassword,
        subdomainUrl,
      );
      const displayCompany: string | undefined = (user as any)?.companyName;
      const subjectPrefix = displayCompany ? `${displayCompany} - ` : '';
      await this.mailer.sendMail({
        companyId: user.companyId,
        to: user.email,
        subject: `${subjectPrefix}Your Store is Ready (Login & Subdomain)`,
        html,
      });
    } catch (error) {
      console.error('Failed to send invoice-paid store-ready email:', error);
    }
  }

  /**
   * Normalize a string into a DNS-safe subdomain slug.
   */
  private slugifyForSubdomain(input: string): string {
    const base = (input || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric -> dash
      .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes

    if (base.length === 0) {
      return `shop-${Date.now()}`;
    }
    return base;
  }

  /**
   * Ensure that a user has exactly one auto-managed project/domain (subdomain).
   *
   * - If the user already has a subdomain, it is returned as-is.
   * - If not, a new unique subdomain is generated and saved.
   *
   * This is the ONLY place where subdomains should be created/assigned so that
   * business rules are enforced consistently (first successful PAID invoice).
   */
  async ensureProjectDomainForUser(userId: number): Promise<{
    subdomain: string | null;
    customDomain: string | null;
    companyId: string;
  }> {
    const user = await this.systemUserRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('System user not found');
    }

    // If user already has a subdomain, just reuse it
    if (user.subdomain) {
      return {
        subdomain: user.subdomain,
        customDomain: user.customDomain,
        companyId: user.companyId,
      };
    }

    // Generate a base slug from company name or fallback identifiers
    const seed =
      (user as any).companyName ||
      user.companyId ||
      `shop-${user.id}`;
    const base = this.slugifyForSubdomain(seed);

    let candidate = base;
    let counter = 1;

    // Find a globally unique subdomain (subdomain column is already unique at DB level)
    // but we proactively avoid collisions before hitting the constraint.
    // Each user can therefore end up with ONLY ONE subdomain.
    // Later invoices / payments simply reuse this value.
    // eslint-disable-next-line no-constant-condition
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

  /**
   * According to Railway wildcard documentation (https://docs.railway.app/networking/domains):
   * - Wildcard domains (*.example.com) automatically route all subdomains
   * - Once wildcard DNS is configured, no API calls needed for individual subdomains
   * - Railway automatically provisions SSL certificates
   * 
   * This method logs that subdomain is ready - Railway will route it automatically
   * via wildcard DNS configuration (*.console.innowavecart.app → Railway service)
   */
  async provisionSubdomainInRailway(userId: number): Promise<void> {
    const user = await this.systemUserRepo.findOne({ where: { id: userId } });
    if (!user || !user.subdomain) {
      return;
    }

    const mainDomain = 
      this.configService.get<string>('MAIN_DOMAIN') ||
      process.env.MAIN_DOMAIN ||
      'console.innowavecart.app';
    
    const fullSubdomain = `${user.subdomain}.${mainDomain}`;

    // Railway wildcard DNS handles subdomains automatically
    // No API call needed - just ensure wildcard DNS is configured:
    // *.console.innowavecart.app → Railway service domain (e.g., abc123.up.railway.app)
    console.log(`✅ Subdomain "${fullSubdomain}" ready`);
    console.log('📋 Railway will route automatically via wildcard DNS');
    console.log('💡 Ensure wildcard DNS is configured: *.console.innowavecart.app → Railway service');
    console.log('💡 Railway will automatically provision SSL certificate');
  }

  /**
   * Custom domain flow: User's main domain / CNAME is saved in database.
   * Super admin manually configures the domain in Railway dashboard (no API automation).
   * Railway will auto-provision SSL once DNS/CNAME is configured.
   */
  async provisionCustomDomainInRailway(userId: number): Promise<void> {
    const user = await this.systemUserRepo.findOne({ where: { id: userId } });
    if (!user || !user.customDomain) {
      return;
    }

    const domain = user.customDomain.toLowerCase().trim();

    // Domain already saved in database by updateDomain
    // Super admin will manually add this domain in Railway and configure CNAME
    console.log(`📝 Custom domain saved: ${domain} (userId: ${userId}, companyId: ${user.companyId})`);
    console.log('📋 Super admin: Add this domain manually in Railway dashboard → Service → Settings → Domains → "+ Custom Domain"');
    console.log(`📋 Then configure CNAME (or A/ALIAS for root) as per Railway. SSL will auto-provision.`);
  }

  /**
   * Mark a user's custom domain as verified/active after DNS check passes.
   */
  async markCustomDomainActive(userId: number): Promise<void> {
    const user = await this.systemUserRepo.findOne({ where: { id: userId } });
    if (!user || !user.customDomain) {
      return;
    }

    (user as any).customDomainStatus = 'active';
    await this.systemUserRepo.save(user);
  }

  /** Generate a secure token for TXT verification (stored in customDomainVerificationCode). */
  generateCustomDomainVerificationToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /** Normalize domain: lowercase, strip protocol and trailing slash. Return apex (no www). */
  normalizeCustomDomain(domain: string): string {
    let d = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
    if (d.startsWith('www.')) {
      d = d.slice(4);
    }
    return d;
  }

  /** Find all users with custom domain in pending_dns (for cron). */
  async findPendingDnsDomains(): Promise<SystemUser[]> {
    return this.systemUserRepo.find({
      where: { customDomainStatus: 'pending_dns' as CustomDomainStatus },
      select: ['id', 'companyId', 'customDomain', 'customDomainVerificationCode'],
    }) as Promise<SystemUser[]>;
  }

  /** Find all users with custom domain in ssl_provisioning (for cron). */
  async findSslProvisioningDomains(): Promise<SystemUser[]> {
    return this.systemUserRepo.find({
      where: { customDomainStatus: 'ssl_provisioning' as CustomDomainStatus },
      select: ['id', 'companyId', 'customDomain', 'cloudflareHostnameId'],
    }) as Promise<SystemUser[]>;
  }

  async setCustomDomainVerified(userId: number): Promise<void> {
    await this.systemUserRepo.update(
      { id: userId },
      {
        customDomainStatus: 'verified' as CustomDomainStatus,
        customDomainVerifiedAt: new Date(),
      } as any,
    );
  }

  async setCustomDomainSslProvisioning(userId: number, cloudflareHostnameId: string | null): Promise<void> {
    await this.systemUserRepo.update(
      { id: userId },
      {
        customDomainStatus: 'ssl_provisioning' as CustomDomainStatus,
        ...(cloudflareHostnameId != null && { cloudflareHostnameId }),
      } as any,
    );
  }

  async setCustomDomainActive(userId: number): Promise<void> {
    await this.systemUserRepo.update(
      { id: userId },
      {
        customDomainStatus: 'active' as CustomDomainStatus,
        sslProvisionedAt: new Date(),
      } as any,
    );
  }

  async setCustomDomainFailed(userId: number): Promise<void> {
    await this.systemUserRepo.update(
      { id: userId },
      { customDomainStatus: 'failed' as CustomDomainStatus } as any,
    );
  }

  async setCloudflareHostnameId(userId: number, hostnameId: string): Promise<void> {
    await this.systemUserRepo.update(
      { id: userId },
      { cloudflareHostnameId: hostnameId } as any,
    );
  }

  async create(dto: CreateSystemuserDto, creatorCompanyId?: string, creatorRole?: SystemUserRole, performedByUserId?: number) {
    const exists = await this.systemUserRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email already exists');
    
    // Determine role
    // - Super Admin endpoint explicitly sets SYSTEM_OWNER (handled in controller)
    // - If no role specified and creator is System Owner -> EMPLOYEE
    // - If no role specified and no creator (direct creation) -> SYSTEM_OWNER
    let role = dto.role;
    if (!role) {
      if (creatorRole === SystemUserRole.SYSTEM_OWNER) {
        role = SystemUserRole.EMPLOYEE; // System Owner creates employees
      } else {
        role = SystemUserRole.SYSTEM_OWNER; // Default to SYSTEM_OWNER for new companies
      }
    }

    // Validate role assignment
    if (role === SystemUserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot create SUPER_ADMIN role');
    }

    // Super Admin or System Owner can create System Owner
    // System Owner can create other System Owners (they share the same companyId)
    if (role === SystemUserRole.SYSTEM_OWNER) {
      // Normalize creator role to support both enum values and raw string 'SUPER_ADMIN'
      const normalizedCreatorRole = creatorRole as any;
      if (
        normalizedCreatorRole &&
        normalizedCreatorRole !== SystemUserRole.SUPER_ADMIN &&
        normalizedCreatorRole !== 'SUPER_ADMIN' &&
        normalizedCreatorRole !== SystemUserRole.SYSTEM_OWNER
      ) {
        throw new BadRequestException('Only Super Admin or System Owner can create System Owner');
      }
    }

    // Reseller: always use same companyId from body (no new company created)
    // Otherwise: creator's companyId if provided, else generate new one
    const dtoCompanyId = dto.companyId;
    let companyId: string;
    if (role === SystemUserRole.RESELLER && dtoCompanyId && typeof dtoCompanyId === 'string') {
      companyId = dtoCompanyId.trim();
    } else {
      companyId = creatorCompanyId || (await this.companyIdService.generateNextCompanyId());
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(dto.password, salt);

    // System Owner gets MANAGE_USERS and STAFF permissions by default
    // Permissions will be synced from package when packageId is assigned
    let permissions = dto.permissions || [];
    if (role === SystemUserRole.SYSTEM_OWNER) {
      if (!permissions.includes(FeaturePermission.MANAGE_USERS)) {
        permissions = [...permissions, FeaturePermission.MANAGE_USERS];
      }
      if (!permissions.includes(FeaturePermission.STAFF)) {
        permissions = [...permissions, FeaturePermission.STAFF];
      }
    }
    
    // If packageId is provided during creation, sync permissions from package
    if ((dto as any).packageId) {
      const packageEntity = await this.packageRepo.findOne({ 
        where: { id: (dto as any).packageId } 
      });
      if (packageEntity && packageEntity.features && Array.isArray(packageEntity.features)) {
        const packageFeatures = packageEntity.features;
        const mergedPermissions = [...new Set([...packageFeatures, ...permissions])];
        
        // System Owner always gets MANAGE_USERS and STAFF
        if (role === SystemUserRole.SYSTEM_OWNER) {
          if (!mergedPermissions.includes(FeaturePermission.MANAGE_USERS)) {
            mergedPermissions.push(FeaturePermission.MANAGE_USERS);
          }
          if (!mergedPermissions.includes(FeaturePermission.STAFF)) {
            mergedPermissions.push(FeaturePermission.STAFF);
          }
        }
        
        permissions = mergedPermissions;
      }
    }

    const entity = this.systemUserRepo.create({
      name: dto.name,
      email: dto.email,
      companyName: (dto as any).companyName,
      companyId,
      // NOTE: Subdomain / project domain is NOT set at creation time.
      // It is created automatically after the first successful (PAID) invoice
      // via `ensureProjectDomainForUser` to guarantee that:
      // - Each user has ONLY ONE project/domain
      // - Later invoices reuse the same domain instead of creating new ones
      companyLogo: (dto as any).companyLogo ?? null,
      phone: (dto as any).phone ?? null,
      branchLocation: (dto as any).branchLocation ?? null,
      primaryColor: (dto as any).primaryColor ?? undefined,
      secondaryColor: (dto as any).secondaryColor ?? undefined,
      passwordSalt: salt,
      passwordHash: hash,
      isActive: true,
      paymentInfo: (dto as any).paymentInfo ?? null,
      packageId: (dto as any).packageId ?? null,
      themeId: (dto as any).themeId ?? null,
      permissions,
      role,
      // For resellers: optional commission % admin charges on their sales
      resellerCommissionRate:
        (dto as any).resellerCommissionRate != null
          ? (dto as any).resellerCommissionRate
          : null,
    });

    await this.systemUserRepo.save(entity);

    // Fetch the created user with package, theme and invoice details
    const createdUser = await this.systemUserRepo.findOne({
      where: { email: dto.email },
      relations: ['package', 'theme', 'invoices'],
    });

    // Log activity
    if (performedByUserId && createdUser) {
      try {
        await this.activityLogService.logActivity({
          companyId: createdUser.companyId,
          action: ActivityAction.CREATE,
          entity: ActivityEntity.SYSTEM_USER,
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
      } catch (error) {
        console.error('Failed to log activity:', error);
        // Don't throw - activity logging failure shouldn't break the operation
      }
    }

    // Send welcome email with credentials if System Owner created an Employee
    if (role === SystemUserRole.EMPLOYEE && creatorRole === SystemUserRole.SYSTEM_OWNER && createdUser) {
      await this.sendWelcomeEmail(createdUser, dto.password);
    }

    // Notify admin when a reseller account is created
    if (role === SystemUserRole.RESELLER && createdUser) {
      await this.notifyAdminNewReseller(createdUser as SystemUser);
    }

    const { passwordHash, passwordSalt, ...safe } = createdUser as any;
    return safe;
  }

  async findAll(companyId?: string) {
    const whereCondition = companyId ? { companyId } : {};
    let list: SystemUser[];
    try {
      list = await this.systemUserRepo.find({
        where: whereCondition,
        order: { id: 'DESC' },
        relations: ['package', 'theme', 'invoices'],
      });
    } catch (error) {
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

  async findOne(id: number, companyId?: string) {
    // Validate id is a valid number
    if (!id || isNaN(Number(id))) {
      throw new NotFoundException('Invalid user ID');
    }
    
    const whereCondition: any = { id: Number(id) };
    if (companyId) {
      whereCondition.companyId = companyId;
    }
    const entity = await this.systemUserRepo.findOne({ 
      where: whereCondition,
      relations: ['package', 'theme', 'invoices'],
    });
    if (!entity) throw new NotFoundException('System user not found');
    const { passwordHash, passwordSalt, ...safe } = entity as any;
    return safe;
  }

  async update(id: number, dto: UpdateSystemuserDto, companyId?: string, performedByUserId?: number) {
    const whereCondition: any = { id };
    if (companyId) {
      whereCondition.companyId = companyId;
    }
    const entity = await this.systemUserRepo.findOne({ where: whereCondition });
    if (!entity) throw new NotFoundException('System user not found');

    const previousRole = entity.role;
    const previousIsActive = entity.isActive;

    let passwordUpdated = false;
    let newPassword: string | undefined;

    if ((dto as any).email && (dto as any).email !== entity.email) {
      const exists = await this.systemUserRepo.findOne({ where: { email: (dto as any).email } });
      if (exists) throw new BadRequestException('Email already exists');
      entity.email = (dto as any).email;
    }

    if ((dto as any).name !== undefined) entity.name = (dto as any).name;
    if ((dto as any).companyName !== undefined) {
      (entity as any).companyName = (dto as any).companyName;
    }

    if ((dto as any).subdomain !== undefined) {
      // Subdomains are managed automatically after payment.
      // Prevent manual changes here to enforce the "one project/domain per user"
      // business rule and avoid duplicate/invalid domains.
      if ((dto as any).subdomain !== entity.subdomain) {
        throw new BadRequestException(
          'Subdomain is managed automatically after the first successful payment and cannot be changed manually',
        );
      }
    }

    // Allow toggling whether the platform subdomain should be served directly.
    if ((dto as any).subdomainEnabled !== undefined) {
      (entity as any).subdomainEnabled = Boolean((dto as any).subdomainEnabled);
    }

    if ((dto as any).customDomain !== undefined) {
      const rawDomain = (dto as any).customDomain;
      if (rawDomain) {
        const newDomain = this.normalizeCustomDomain(rawDomain);
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(newDomain)) {
          throw new BadRequestException('Invalid domain format');
        }
        const existing = await this.systemUserRepo.findOne({ where: { customDomain: newDomain } });
        if (existing && existing.id !== id) {
          throw new BadRequestException('This domain is already in use by another store');
        }
        entity.customDomain = newDomain;
        (entity as any).customDomainStatus = 'pending_dns';
        (entity as any).customDomainVerificationCode = this.generateCustomDomainVerificationToken();
        (entity as any).customDomainVerifiedAt = null;
        (entity as any).sslProvisionedAt = null;
        (entity as any).cloudflareHostnameId = null;
      } else {
        entity.customDomain = null;
        (entity as any).customDomainStatus = 'pending_dns';
        (entity as any).customDomainVerificationCode = null;
        (entity as any).customDomainVerifiedAt = null;
        (entity as any).sslProvisionedAt = null;
        (entity as any).cloudflareHostnameId = null;
      }
    }

    if ((dto as any).companyLogo !== undefined) {
      (entity as any).companyLogo = (dto as any).companyLogo;
    }
    if ((dto as any).phone !== undefined) {
      (entity as any).phone = (dto as any).phone;
    }
    if ((dto as any).branchLocation !== undefined) {
      (entity as any).branchLocation = (dto as any).branchLocation;
    }
    if ((dto as any).primaryColor !== undefined) {
      (entity as any).primaryColor = (dto as any).primaryColor;
    }
    if ((dto as any).secondaryColor !== undefined) {
      (entity as any).secondaryColor = (dto as any).secondaryColor;
    }
    if ((dto as any).pathaoConfig !== undefined) {
      (entity as any).pathaoConfig = (dto as any).pathaoConfig;
    }
    if ((dto as any).steadfastConfig !== undefined) {
      (entity as any).steadfastConfig = (dto as any).steadfastConfig;
    }
    if ((dto as any).redxConfig !== undefined) {
      (entity as any).redxConfig = (dto as any).redxConfig;
    }
    if ((dto as any).notificationConfig !== undefined) {
      (entity as any).notificationConfig = (dto as any).notificationConfig;
    }

    if ((dto as any).password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = this.hashPassword((dto as any).password, salt);
      entity.passwordSalt = salt;
      entity.passwordHash = hash;
      passwordUpdated = true;
      newPassword = (dto as any).password;
    }

    if ((dto as any).paymentInfo !== undefined) {
      (entity as any).paymentInfo = (dto as any).paymentInfo;
    }

    // Update reseller commission rate if provided
    if ((dto as any).resellerCommissionRate !== undefined) {
      (entity as any).resellerCommissionRate =
        (dto as any).resellerCommissionRate != null
          ? (dto as any).resellerCommissionRate
          : null;
    }

    if ((dto as any).packageId !== undefined) {
      const newPackageId = (dto as any).packageId;
      const currentPackageId = entity.packageId ?? (entity as any).packageId;
      // Store previous package for automatic fallback when payment fails or is reverted
      if (newPackageId != null && currentPackageId != null && Number(newPackageId) !== Number(currentPackageId)) {
        (entity as any).previousPackageId = currentPackageId;
      }
      (entity as any).packageId = newPackageId;

      // When package is assigned/updated, sync package features to System Owner's permissions
      if ((dto as any).packageId) {
        const packageEntity = await this.packageRepo.findOne({ 
          where: { id: (dto as any).packageId } 
        });
        if (packageEntity && packageEntity.features && Array.isArray(packageEntity.features)) {
          // For System Owner: Package features become their permissions
          // For Employees: They can only get permissions from System Owner's package
          const packageFeatures = packageEntity.features;
          
          if (entity.role === SystemUserRole.SYSTEM_OWNER) {
            // System Owner: Package features = their permissions
            const mergedPermissions = [...new Set([...packageFeatures])];
            
            // System Owner always gets MANAGE_USERS and STAFF
            if (!mergedPermissions.includes(FeaturePermission.MANAGE_USERS)) {
              mergedPermissions.push(FeaturePermission.MANAGE_USERS);
            }
            if (!mergedPermissions.includes(FeaturePermission.STAFF)) {
              mergedPermissions.push(FeaturePermission.STAFF);
            }
            
            (entity as any).permissions = mergedPermissions;
          } else {
            // Employee: Only keep permissions that are in the package (System Owner's package)
            const existingPermissions = entity.permissions || [];
            const validPermissions = existingPermissions.filter(p => packageFeatures.includes(p as FeaturePermission));
            (entity as any).permissions = validPermissions;
          }
        }
      } else if ((dto as any).packageId === null) {
        // Package removed - clear permissions except MANAGE_USERS and STAFF for System Owner
        if (entity.role === SystemUserRole.SYSTEM_OWNER) {
          (entity as any).permissions = [FeaturePermission.MANAGE_USERS, FeaturePermission.STAFF];
        } else {
          (entity as any).permissions = [];
        }
      }
    }

    if ((dto as any).themeId !== undefined) {
      (entity as any).themeId = (dto as any).themeId;
    }

    if ((dto as any).permissions !== undefined) {
      (entity as any).permissions = (dto as any).permissions || [];
    }

    if ((dto as any).role !== undefined) {
      // Prevent changing to SUPER_ADMIN
      if ((dto as any).role === SystemUserRole.SUPER_ADMIN) {
        throw new BadRequestException('Cannot change role to SUPER_ADMIN');
      }
      (entity as any).role = (dto as any).role;
    }

    if ((dto as any).isActive !== undefined) {
      entity.isActive = (dto as any).isActive;
    }

    // Store old values for activity log
    const oldValues = {
      name: entity.name,
      email: entity.email,
      phone: (entity as any).phone,
      isActive: entity.isActive,
      role: entity.role,
    };

    await this.systemUserRepo.save(entity);

    // Fetch the updated user with package, theme and invoice details
    const updatedUser = await this.systemUserRepo.findOne({
      where: { id },
      relations: ['package', 'theme', 'invoices'],
    });

    // Send update email only when password is updated
    if (passwordUpdated && newPassword) {
      await this.sendUpdateEmail(updatedUser, newPassword);
    }

    // If role changed to RESELLER, notify admin
    if (
      previousRole !== SystemUserRole.RESELLER &&
      updatedUser.role === SystemUserRole.RESELLER
    ) {
      await this.notifyAdminNewReseller(updatedUser);
    }

    // If account was inactive and is now active, send activation email to user
    if (!previousIsActive && updatedUser?.isActive && updatedUser.email) {
      try {
        const displayCompany: string | undefined = (updatedUser as any)?.companyName;
        const subjectPrefix = displayCompany ? `${displayCompany} - ` : '';
        const subject = `${subjectPrefix}Your account is now active`;
        const greetingName = updatedUser.name || updatedUser.email;
        const loginUrl =
          this.configService.get<string>('RESELLER_LOGIN_URL') ||
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
      } catch (error) {
        console.error('Failed to send system user activation email:', error);
      }
    }

    // Log activity
    if (performedByUserId && updatedUser) {
      try {
        const newValues: any = {
          name: updatedUser.name,
          email: updatedUser.email,
          phone: (updatedUser as any).phone,
          isActive: updatedUser.isActive,
          role: updatedUser.role,
        };
        if (passwordUpdated) {
          newValues.passwordChanged = true;
        }

        await this.activityLogService.logActivity({
          companyId: updatedUser.companyId,
          action: ActivityAction.UPDATE,
          entity: ActivityEntity.SYSTEM_USER,
          entityId: updatedUser.id,
          entityName: updatedUser.name || updatedUser.email,
          description: `Updated system user: ${updatedUser.name} (${updatedUser.email})`,
          oldValues,
          newValues,
          performedByUserId,
          targetUserId: updatedUser.id,
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    }

    const { passwordHash, passwordSalt, ...safe } = updatedUser as any;
    return safe;
  }

  /**
   * Revert user's package to the previous one (automatic fallback when payment fails or is cancelled).
   */
  async revertToPreviousPackage(id: number, companyId?: string, performedByUserId?: number) {
    const whereCondition: any = { id };
    if (companyId) {
      whereCondition.companyId = companyId;
    }
    const entity = await this.systemUserRepo.findOne({ where: whereCondition });
    if (!entity) throw new NotFoundException('System user not found');

    const previousId = (entity as any).previousPackageId;
    if (previousId == null) {
      throw new BadRequestException('No previous package to revert to');
    }

    const currentPackageId = entity.packageId ?? (entity as any).packageId;
    (entity as any).packageId = previousId;
    (entity as any).previousPackageId = null;

    const packageEntity = await this.packageRepo.findOne({ where: { id: previousId } });
    if (packageEntity?.features && Array.isArray(packageEntity.features)) {
      const packageFeatures = packageEntity.features;
      if (entity.role === SystemUserRole.SYSTEM_OWNER) {
        const merged = [...new Set([...packageFeatures])];
        if (!merged.includes(FeaturePermission.MANAGE_USERS)) merged.push(FeaturePermission.MANAGE_USERS);
        if (!merged.includes(FeaturePermission.STAFF)) merged.push(FeaturePermission.STAFF);
        (entity as any).permissions = merged;
      } else {
        const existing = entity.permissions || [];
        (entity as any).permissions = existing.filter((p) => packageFeatures.includes(p as FeaturePermission));
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
          action: ActivityAction.UPDATE,
          entity: ActivityEntity.SYSTEM_USER,
          entityId: updatedUser.id,
          entityName: updatedUser.name || updatedUser.email,
          description: `Reverted package to previous (fallback)`,
          oldValues: { packageId: currentPackageId },
          newValues: { packageId: previousId },
          performedByUserId,
          targetUserId: updatedUser.id,
        });
      } catch (e) {
        console.error('Failed to log activity:', e);
      }
    }

    const { passwordHash, passwordSalt, ...safe } = updatedUser as any;
    return safe;
  }

  async remove(id: number, companyId?: string, performedByUserId?: number) {
    const whereCondition: any = { id };
    if (companyId) {
      whereCondition.companyId = companyId;
    }
    const entity = await this.systemUserRepo.findOne({ where: whereCondition });
    if (!entity) throw new NotFoundException('System user not found');
    
    // Log activity before deletion
    if (performedByUserId) {
      try {
        await this.activityLogService.logActivity({
          companyId: entity.companyId,
          action: ActivityAction.DELETE,
          entity: ActivityEntity.SYSTEM_USER,
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
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    }

    await this.systemUserRepo.softRemove(entity);
    return { success: true };
  }

  async listTrashed(companyId?: string) {
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
    return list.map(({ passwordHash, passwordSalt, ...safe }) => safe as any);
  }

  async restore(id: number, companyId?: string, performedByUserId?: number) {
    const whereCondition: any = { id };
    if (companyId) {
      whereCondition.companyId = companyId;
    }
    const entity = await this.systemUserRepo.findOne({
      where: whereCondition,
      withDeleted: true,
      relations: ['package', 'theme', 'invoices'],
    });
    if (!entity) throw new NotFoundException('System user not found');
    if (!entity.deletedAt) {
      const { passwordHash, passwordSalt, ...safe } = entity as any;
      return safe;
    }

    await this.systemUserRepo.recover(entity);

    const restored = await this.systemUserRepo.findOne({
      where: { id: entity.id },
      relations: ['package', 'theme', 'invoices'],
    });
    if (!restored) throw new NotFoundException('System user not found after restore');

    if (performedByUserId) {
      try {
        await this.activityLogService.logActivity({
          companyId: restored.companyId,
          action: ActivityAction.UPDATE,
          entity: ActivityEntity.SYSTEM_USER,
          entityId: restored.id,
          entityName: restored.name || restored.email,
          description: `Restored system user: ${restored.name} (${restored.email})`,
          oldValues: { deletedAt: entity.deletedAt },
          newValues: { deletedAt: null },
          performedByUserId,
          targetUserId: restored.id,
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    }

    const { passwordHash, passwordSalt, ...safe } = restored as any;
    return safe;
  }

  async permanentDelete(id: number, companyId?: string, performedByUserId?: number) {
    const whereCondition: any = { id };
    if (companyId) {
      whereCondition.companyId = companyId;
    }
    const entity = await this.systemUserRepo.findOne({
      where: whereCondition,
      withDeleted: true,
    });
    if (!entity) throw new NotFoundException('System user not found in trash');
    if (!entity.deletedAt) {
      throw new BadRequestException('System user is not in trash');
    }

    if (performedByUserId) {
      try {
        await this.activityLogService.logActivity({
          companyId: entity.companyId,
          action: ActivityAction.DELETE,
          entity: ActivityEntity.SYSTEM_USER,
          entityId: entity.id,
          entityName: entity.name || entity.email,
          description: `Permanently deleted system user: ${entity.name} (${entity.email})`,
          oldValues: { deletedAt: entity.deletedAt },
          newValues: { deletedAt: null },
          performedByUserId,
          targetUserId: entity.id,
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    }

    await this.systemUserRepo.remove(entity);
    return { success: true };
  }

  async login(dto: LoginDto) {
    const user = await this.systemUserRepo.findOne({ 
      where: { email: dto.email },
      relations: ['package', 'theme', 'invoices'],
    });
    if (!user) throw new NotFoundException('Invalid credentials');
    
    // Explicit check for password in DTO (defense in depth)
    if (!dto.password) {
       throw new BadRequestException('Password is required');
    }

    // Check if user has password set
    if (!user.passwordSalt || !user.passwordHash) {
       // User exists but has no password (maybe external auth or unfinished setup)
       throw new NotFoundException('Invalid credentials'); 
    }

    const hash = this.hashPassword(dto.password, user.passwordSalt);
    if (hash !== user.passwordHash) throw new NotFoundException('Invalid credentials');

    // If reseller is inactive, block login with clear message
    if (!user.isActive && user.role === SystemUserRole.RESELLER) {
      throw new BadRequestException(
        'Your reseller account is inactive. Please clear pending payments and contact the admin.',
      );
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
      role: user.role || SystemUserRole.EMPLOYEE,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '24d' });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, userId: user.id },
      { expiresIn: '24d' }
    );

    const { passwordHash, passwordSalt, ...safe } = user as any;
    return { accessToken, refreshToken, user: safe };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.jwtService.verify<{ sub: number; userId: number }>(refreshToken);
    const userId = payload?.sub ?? payload?.userId;
    if (!userId) {
      throw new BadRequestException('Invalid refresh token');
    }
    const user = await this.systemUserRepo.findOne({
      where: { id: userId },
      relations: ['package', 'theme', 'invoices'],
    });
    if (!user || !user.isActive) {
      throw new BadRequestException('User not found or inactive');
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
      role: user.role || SystemUserRole.EMPLOYEE,
    };
    const accessToken = this.jwtService.sign(tokenPayload, { expiresIn: '24d' });
    const newRefreshToken = this.jwtService.sign(
      { sub: user.id, userId: user.id },
      { expiresIn: '24d' },
    );
    return { accessToken, refreshToken: newRefreshToken };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.systemUserRepo.findOne({ 
      where: { email: dto.email }
    });

    if (!user) {
      // For security reasons, we don't reveal if the email exists or not
      return { 
        success: true, 
        message: 'If the email exists, a password reset link has been sent.' 
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token expiry to 1 hour from now
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

    // Save token to user
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = resetTokenExpiry;
    await this.systemUserRepo.save(user);

    // Create reset link
    const frontendUrl = 'https://www.fiberace.shop';
    const resetLink = `${frontendUrl}/reset-password?id=${user.id}&token=${resetToken}`;

    // Send email
    try {
      const html = EmailTemplates.getPasswordResetTemplate(user, resetLink);
      const displayCompany: string | undefined = (user as any)?.companyName;
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
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new BadRequestException('Failed to send password reset email. Please try again later.');
    }
  }

  async resetPassword(userId: number, token: string, dto: ResetPasswordDto) {
    // Validate passwords match
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await this.systemUserRepo.findOne({ 
      where: { 
        id: userId,
        resetPasswordToken: resetTokenHash
      }
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token is expired
    if (user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Reset token has expired. Please request a new one.');
    }

    // Update password
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(dto.password, salt);
    user.passwordSalt = salt;
    user.passwordHash = hash;

    // Clear reset token fields
    user.resetPasswordToken = '';
    user.resetPasswordExpires = new Date();

    await this.systemUserRepo.save(user);

    return { 
      success: true, 
      message: 'Password has been reset successfully. You can now login with your new password.' 
    };
  }

  async assignPermissions(userId: number, permissions: string[], companyId?: string, assignerPermissions?: string[], performedByUserId?: number) {
    const whereCondition: any = { id: userId };
    if (companyId) {
      whereCondition.companyId = companyId;
    }
    const entity = await this.systemUserRepo.findOne({ 
      where: whereCondition,
      relations: ['package'],
    });
    if (!entity) throw new NotFoundException('System user not found');

    // If assigner has permissions, validate that they can only assign permissions they have
    if (assignerPermissions && assignerPermissions.length > 0) {
      const invalidPermissions = permissions.filter(p => !assignerPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        throw new BadRequestException(
          `Cannot assign permissions you don't have: ${invalidPermissions.join(', ')}`
        );
      }
    }

    // For employees, ensure they don't get permissions beyond what System Owner has
    // System Owner's permissions come from their package
    if (entity.role === SystemUserRole.EMPLOYEE && entity.package) {
      const packageFeatures = entity.package.features || [];
      const validPermissions = permissions.filter(p => packageFeatures.includes(p as FeaturePermission));
      entity.permissions = validPermissions;
    } else {
      entity.permissions = permissions;
    }

    // Store old permissions for activity log
    const oldPermissions = entity.permissions || [];

    await this.systemUserRepo.save(entity);

    // Log activity
    if (performedByUserId) {
      try {
        await this.activityLogService.logActivity({
          companyId: entity.companyId,
          action: ActivityAction.PERMISSION_ASSIGN,
          entity: ActivityEntity.SYSTEM_USER,
          entityId: entity.id,
          entityName: entity.name || entity.email,
          description: `Assigned permissions to ${entity.name} (${entity.email})`,
          oldValues: { permissions: oldPermissions },
          newValues: { permissions: entity.permissions || [] },
          performedByUserId,
          targetUserId: entity.id,
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    }

    const { passwordHash, passwordSalt, ...safe } = entity as any;
    return {
      statusCode: 200,
      message: 'Permissions assigned successfully',
      data: safe,
    };
  }
}
