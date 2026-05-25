import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateSystemuserDto } from './dto/create-systemuser.dto';
import { UpdateSystemuserDto } from './dto/update-systemuser.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Repository } from 'typeorm';
import { SystemUser } from './entities/systemuser.entity';
import { Package } from '../package/entities/package.entity';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { CompanyIdService } from '../common/services/company-id.service';
import { SystemUserRole } from './system-user-role.enum';
import { ActivityLogService } from './activity-log.service';
import type { CustomDomainStatus } from './custom-domain-status.enum';
export declare class SystemuserService implements OnModuleInit {
    private readonly systemUserRepo;
    private readonly packageRepo;
    private readonly jwtService;
    private readonly companyIdService;
    private readonly activityLogService;
    private readonly configService;
    private readonly mailer;
    constructor(systemUserRepo: Repository<SystemUser>, packageRepo: Repository<Package>, jwtService: JwtService, companyIdService: CompanyIdService, activityLogService: ActivityLogService, configService: ConfigService, mailer: {
        sendMail: (message: any) => Promise<{
            id?: string;
        }>;
    });
    onModuleInit(): Promise<void>;
    findOneByCompanyId(companyId: string): Promise<SystemUser | null>;
    private hashPassword;
    private isMissingPaidColumnsError;
    private ensurePaidColumnsExist;
    private sendUpdateEmail;
    private notifyAdminNewReseller;
    private sendWelcomeEmail;
    sendInvoicePaidStoreReadyEmail(userId: number): Promise<void>;
    private slugifyForSubdomain;
    ensureProjectDomainForUser(userId: number): Promise<{
        subdomain: string | null;
        customDomain: string | null;
        companyId: string;
    }>;
    provisionSubdomainInRailway(userId: number): Promise<void>;
    provisionCustomDomainInRailway(userId: number): Promise<void>;
    markCustomDomainActive(userId: number): Promise<void>;
    generateCustomDomainVerificationToken(): string;
    normalizeCustomDomain(domain: string): string;
    findPendingDnsDomains(): Promise<SystemUser[]>;
    findSslProvisioningDomains(): Promise<SystemUser[]>;
    setCustomDomainVerified(userId: number): Promise<void>;
    setCustomDomainSslProvisioning(userId: number, cloudflareHostnameId: string | null): Promise<void>;
    setCustomDomainActive(userId: number): Promise<void>;
    setCustomDomainFailed(userId: number): Promise<void>;
    setCloudflareHostnameId(userId: number, hostnameId: string): Promise<void>;
    create(dto: CreateSystemuserDto, creatorCompanyId?: string, creatorRole?: SystemUserRole, performedByUserId?: number): Promise<any>;
    findAll(companyId?: string): Promise<{
        id: number;
        name: string;
        designation: string;
        photo: string;
        email: string;
        companyName: string;
        companyId: string;
        subdomain: string | null;
        subdomainEnabled: boolean;
        customDomain: string | null;
        customDomainStatus: CustomDomainStatus;
        customDomainVerificationCode: string | null;
        customDomainVerifiedAt: Date | null;
        sslProvisionedAt: Date | null;
        cloudflareHostnameId: string | null;
        companyLogo: string;
        phone: string;
        branchLocation: string;
        primaryColor: string;
        secondaryColor: string;
        resetPasswordToken: string;
        resetPasswordExpires: Date;
        isActive: boolean;
        paymentInfo: {
            paymentstatus?: string;
            paymentmethod?: string;
            amount?: number;
            packagename?: string;
        };
        packageId: number;
        package: Package;
        previousPackageId: number | null;
        themeId: number;
        theme: import("../theme/entities/theme.entity").Theme;
        invoices: import("../invoice/entities/invoice.entity").Invoice[];
        pathaoConfig: {
            clientId?: string;
            clientSecret?: string;
            username?: string;
            password?: string;
        };
        steadfastConfig: {
            apiKey?: string;
            secretKey?: string;
        };
        redxConfig: {
            token?: string;
            sandbox?: boolean;
        };
        notificationConfig: {
            email?: string;
            whatsapp?: string;
        };
        permissions: string[];
        role: SystemUserRole;
        resellerCommissionRate?: number | null;
        paidTotalSoldQty: number;
        paidTotalEarning: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt?: Date;
    }[]>;
    findOne(id: number, companyId?: string): Promise<any>;
    update(id: number, dto: UpdateSystemuserDto, companyId?: string, performedByUserId?: number): Promise<any>;
    revertToPreviousPackage(id: number, companyId?: string, performedByUserId?: number): Promise<any>;
    remove(id: number, companyId?: string, performedByUserId?: number): Promise<{
        success: boolean;
    }>;
    listTrashed(companyId?: string): Promise<any[]>;
    restore(id: number, companyId?: string, performedByUserId?: number): Promise<any>;
    permanentDelete(id: number, companyId?: string, performedByUserId?: number): Promise<{
        success: boolean;
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
    }>;
    refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
    resetPassword(userId: number, token: string, dto: ResetPasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
    assignPermissions(userId: number, permissions: string[], companyId?: string, assignerPermissions?: string[], performedByUserId?: number): Promise<{
        statusCode: number;
        message: string;
        data: any;
    }>;
}
