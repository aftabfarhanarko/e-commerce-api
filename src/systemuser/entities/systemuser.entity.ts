import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Package } from '../../package/entities/package.entity';
import { Invoice } from '../../invoice/entities/invoice.entity';
import { Theme } from '../../theme/entities/theme.entity';
import { SystemUserRole } from '../system-user-role.enum';
import type { CustomDomainStatus } from '../custom-domain-status.enum';

@Entity('system_users')
export class SystemUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  designation: string;

  @Column({ nullable: true })
  photo: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: false })
  companyName: string;

  @Column({ nullable: false })
  companyId: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  subdomain: string | null;

  /**
   * Controls whether the platform subdomain (e.g. ovi.console.innowavecart.app)
   * should serve the project directly. When disabled and a verified custom
   * domain exists, the middleware will redirect traffic from the subdomain
   * to the custom domain.
   */
  @Column({ type: 'boolean', default: true })
  subdomainEnabled: boolean;

  @Column({ type: 'varchar', unique: true, nullable: true })
  customDomain: string | null;

  /** pending_dns | verified | ssl_provisioning | active | failed (legacy: pending) */
  @Column({
    type: 'varchar',
    length: 32,
    default: 'pending_dns',
  })
  customDomainStatus: CustomDomainStatus;

  @Column({ type: 'varchar', nullable: true })
  customDomainVerificationCode: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'custom_domain_verified_at' })
  customDomainVerifiedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'ssl_provisioned_at' })
  sslProvisionedAt: Date | null;

  @Column({ type: 'varchar', nullable: true, name: 'cloudflare_hostname_id' })
  cloudflareHostnameId: string | null;

  @Column({ nullable: true })
  companyLogo: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  branchLocation: string;

  @Column({ nullable: true })
  primaryColor: string;

  @Column({ nullable: true })
  secondaryColor: string;

  /**
   * Stored as a salted hash – never return this field from APIs.
   */
  @Column({ nullable: true })
  passwordHash: string;

  @Column({ nullable: true })
  passwordSalt: string;

  @Column({ nullable: true })
  resetPasswordToken: string;

  @Column({ nullable: true })
  resetPasswordExpires: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column('json', { nullable: true })
  paymentInfo: {
    paymentstatus?: string;
    paymentmethod?: string;
    amount?: number;
    packagename?: string;
  };

  @Column({ nullable: true })
  packageId: number;

  @ManyToOne(() => Package, { nullable: true })
  @JoinColumn({ name: 'packageId' })
  package: Package;

  /** Previous package before last upgrade; used for automatic fallback on payment failure. */
  @Column('int', { nullable: true })
  previousPackageId: number | null;

  @Column({ nullable: true })
  themeId: number;

  @ManyToOne(() => Theme, { nullable: true })
  @JoinColumn({ name: 'themeId' })
  theme: Theme;

  @OneToMany(() => Invoice, (invoice) => invoice.customer)
  invoices: Invoice[];

  @Column('json', { nullable: true })
  pathaoConfig: {
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
  };

  @Column('json', { nullable: true })
  steadfastConfig: {
    apiKey?: string;
    secretKey?: string;
  };

  @Column('json', { nullable: true })
  redxConfig: {
    token?: string;
    sandbox?: boolean;
  };

  @Column('json', { nullable: true })
  notificationConfig: {
    email?: string;
    whatsapp?: string;
  };

  @Column('json', { nullable: true, default: [] })
  permissions: string[];

  @Column({
    type: 'enum',
    enum: SystemUserRole,
    default: SystemUserRole.EMPLOYEE,
  })
  role: SystemUserRole;

  /**
   * Optional commission rate (%) that admin charges this reseller
   * on each delivered sale of their products.
   * Example: 7.5 means 7.5% of reseller product revenue is admin's commission.
   */
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  resellerCommissionRate?: number | null;


  @Column({ type: 'float', default: 0 })
  paidTotalEarning: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}
