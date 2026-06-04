import { Module, Global } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SystemUser } from './systemuser/entities/systemuser.entity';
import { createTransport } from 'nodemailer';
import { CacheModule } from '@nestjs/cache-manager';
import { SettingService } from './setting/setting.service';

// Modules
import { CategoryModule } from './category/category.module';
import { ProductModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { UsersModule } from './users/users.module';
import { PaymentsModule } from './payments/payments.module';
import { FraudcheckerModule } from './fraudchecker/fraudchecker.module';
import { CartproductsModule } from './cartproducts/cartproducts.module';
import { BannerModule } from './banner/banner.module';
import { PromocodeModule } from './promocode/promocode.module';
import { SettingModule } from './setting/setting.module';
import { HelpModule } from './help/help.module';
import { SystemuserModule } from './systemuser/systemuser.module';
import { EarningsModule } from './earnings/earnings.module';
import { OverviewModule } from './overview/overview.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrivecyPolicyModule } from './privecy-policy/privecy-policy.module';
import { TremsCondetionsModule } from './trems-condetions/trems-condetions.module';
import { RefundPolicyModule } from './refund-policy/refund-policy.module';
import { ReviewsModule } from './reviews/reviews.module';
import { MigrationController } from './migration.controller';
import { HealthModule } from './health/health.module';
import { TrackingModule } from './tracking/tracking.module';
import { PackageModule } from './package/package.module';
import { InvoiceModule } from './invoice/invoice.module';
import { ThemeModule } from './theme/theme.module';
import { SuperadminModule } from './superadmin/superadmin.module';
import { SaleInvoiceModule } from './sale-invoice/sale-invoice.module';
import { CreditNoteModule } from './credit-note/credit-note.module';
import { MediaModule } from './media/media.module';
import { ResellerModule } from './reseller/reseller.module';
import { CashModule } from './cash/cash.module';
import { TopProductsModule } from './top-products/top-products.module';
import { VoiceModule } from './voice/voice.module';

// Static migrations for Vercel/lambda deployment compatibility
import { AddSubdomainEnabledToSystemUser1679999999999 } from './migrations/1679999999999-AddSubdomainEnabledToSystemUser';
import { CustomDomainAutoVerification1739180000000 } from './migrations/1739180000000-CustomDomainAutoVerification';
import { AddPendingStatusToProducts1744000000000 } from './migrations/1744000000000-AddPendingStatusToProducts';
import { FixUserEmailUniqueConstraint1771259405000 } from './migrations/1771259405000-FixUserEmailUniqueConstraint';
import { AddPaidFields1775562076955 } from './migrations/1775562076955-addPaidFields';
import { EnsurePaidFieldsOnSystemUsers1775570000000 } from './migrations/1775570000000-EnsurePaidFieldsOnSystemUsers';
import { AddTypesToProducts1775580000000 } from './migrations/1775580000000-AddTypesToProducts';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ✅ Correct cache config
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // seconds
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      synchronize: false,

      logging: false,
      ssl: {
        rejectUnauthorized: false,
      },
      autoLoadEntities: true,
      migrations: [
        AddSubdomainEnabledToSystemUser1679999999999,
        CustomDomainAutoVerification1739180000000,
        AddPendingStatusToProducts1744000000000,
        FixUserEmailUniqueConstraint1771259405000,
        AddPaidFields1775562076955,
        EnsurePaidFieldsOnSystemUsers1775570000000,
        AddTypesToProducts1775580000000,
      ],
      migrationsRun: true,
      migrationsTransactionMode: 'each',
    }),

    TypeOrmModule.forFeature([SystemUser]),

    ScheduleModule.forRoot(),

    CategoryModule,
    ProductModule,
    OrdersModule,
    UsersModule,
    PaymentsModule,
    FraudcheckerModule,
    CartproductsModule,
    BannerModule,
    PromocodeModule,
    SettingModule,
    HelpModule,
    SystemuserModule,
    EarningsModule,
    OverviewModule,
    NotificationsModule,
    DashboardModule,
    PrivecyPolicyModule,
    TremsCondetionsModule,
    RefundPolicyModule,
    ReviewsModule,
    HealthModule,
    TrackingModule,
    PackageModule,
    InvoiceModule,
    ThemeModule,
    SuperadminModule,
    SaleInvoiceModule,
    CreditNoteModule,
    MediaModule,
    ResellerModule,
    TopProductsModule,
    CashModule,
    VoiceModule,
  ],

  controllers: [AppController, MigrationController],

  providers: [
    AppService,
    {
      provide: 'MAILER_TRANSPORT',
      inject: [ConfigService, SettingService],
      useFactory: (config: ConfigService, settingService: SettingService) => {
        let cached:
          | { key: string; transport: ReturnType<typeof createTransport> }
          | undefined;

        const buildKey = (s: {
          smtpUser: string;
          smtpPass: string;
        }) => [s.smtpUser, s.smtpPass].join('|');

        const buildTransport = (s: {
          smtpUser: string;
          smtpPass: string;
        }) =>
          createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: { user: s.smtpUser, pass: s.smtpPass },
            tls: {
              rejectUnauthorized: false,
            },
            connectionTimeout: 30000,
            greetingTimeout: 30000,
            socketTimeout: 30000,
          });

        return {
          async sendMail(options: any) {
            // Priority: DB settings (set from frontend) -> env fallback
            let setting:
              | {
                smtpUser?: string;
                smtpPass?: string;
              }
              | undefined;

            try {
              if (options?.companyId) {
                setting = await settingService.findFirstByCompanyId(options.companyId);
              }
              if (!setting) {
                setting = await settingService.findFirstByCompanyId(
                  '__SUPERADMIN_SMTP__',
                );
              }
            } catch {
              try {
                setting = await settingService.findFirst();
              } catch {
                // No settings row yet; fallback to env
              }
            }

            const smtpUser = setting?.smtpUser ?? config.get<string>('SMTP_USER');
            const smtpPass = setting?.smtpPass ?? config.get<string>('SMTP_PASS');

            if (!smtpUser || !smtpPass) {
              throw new Error(
                'SMTP is not configured. Set SMTP in Settings (frontend) or provide SMTP_USER/SMTP_PASS env vars.',
              );
            }

            const key = buildKey({
              smtpUser,
              smtpPass,
            });

            if (!cached || cached.key !== key) {
              cached = {
                key,
                transport: buildTransport({
                  smtpUser,
                  smtpPass,
                }),
              };
            }

            const from =
              options?.from ?? smtpUser;

            return cached.transport.sendMail({ ...options, from });
          },
        };
      },
    },
  ],

  exports: ['MAILER_TRANSPORT'],
})
export class AppModule { }
