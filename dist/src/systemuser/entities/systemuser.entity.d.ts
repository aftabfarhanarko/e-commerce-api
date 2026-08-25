import { Package } from '../../package/entities/package.entity';
import { Invoice } from '../../invoice/entities/invoice.entity';
import { Theme } from '../../theme/entities/theme.entity';
import { SystemUserRole } from '../system-user-role.enum';
import type { CustomDomainStatus } from '../custom-domain-status.enum';
export declare class SystemUser {
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
    passwordHash: string;
    passwordSalt: string;
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
    theme: Theme;
    invoices: Invoice[];
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
}
