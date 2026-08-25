import { SystemuserService } from './systemuser.service';
import { ActivityLogService } from './activity-log.service';
import { CreateSystemuserDto } from './dto/create-systemuser.dto';
import { UpdateSystemuserDto } from './dto/update-systemuser.dto';
import { LoginDto } from './dto/login.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { SystemUserRole } from './system-user-role.enum';
import { ActivityAction, ActivityEntity } from './entities/activity-log.entity';
export declare class SystemuserController {
    private readonly systemuserService;
    private readonly activityLogService;
    constructor(systemuserService: SystemuserService, activityLogService: ActivityLogService);
    createSystemOwner(createSystemuserDto: CreateSystemuserDto, creatorCompanyId?: string, req?: any): Promise<any>;
    create(createSystemuserDto: CreateSystemuserDto, creatorCompanyId?: string, req?: any): Promise<any>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
    }>;
    findAll(companyId?: string, req?: any): Promise<{
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
        customDomainStatus: import("./custom-domain-status.enum").CustomDomainStatus;
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
        package: import("../package/entities/package.entity").Package;
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
        paidTotalEarning: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt?: Date;
    }[]>;
    listTrash(companyIdFromQuery?: string, companyIdFromToken?: string, req?: any): Promise<any[]>;
    getActivityLogs(companyId?: string, performedByUserId?: string, targetUserId?: string, action?: ActivityAction, entity?: ActivityEntity, startDate?: string, endDate?: string, limit?: string, offset?: string, req?: any): Promise<{
        logs: import("./entities/activity-log.entity").ActivityLog[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getActivityLogById(id: string, companyId?: string, req?: any): Promise<import("./entities/activity-log.entity").ActivityLog>;
    findOne(id: string, companyId?: string, req?: any): Promise<any>;
    revertPackage(id: string, companyId?: string, req?: any): Promise<any>;
    update(id: string, updateSystemuserDto: UpdateSystemuserDto, companyId?: string, req?: any): Promise<any>;
    restore(id: string, companyIdFromQuery?: string, companyIdFromToken?: string, req?: any): Promise<any>;
    remove(id: string, companyId?: string, req?: any): Promise<{
        success: boolean;
    }>;
    permanentRemove(id: string, companyId?: string, req?: any): Promise<{
        success: boolean;
    }>;
    assignPermissions(id: string, dto: AssignPermissionsDto, companyId?: string, req?: any): Promise<{
        statusCode: number;
        message: string;
        data: any;
    }>;
    getPermissions(id: string, companyId?: string, req?: any): Promise<{
        statusCode: number;
        data: {
            userId: any;
            permissions: any;
        };
    }>;
}
