"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const systemuser_entity_1 = require("./systemuser/entities/systemuser.entity");
const nodemailer_1 = require("nodemailer");
const cache_manager_1 = require("@nestjs/cache-manager");
const setting_service_1 = require("./setting/setting.service");
const category_module_1 = require("./category/category.module");
const products_module_1 = require("./products/products.module");
const orders_module_1 = require("./orders/orders.module");
const users_module_1 = require("./users/users.module");
const payments_module_1 = require("./payments/payments.module");
const fraudchecker_module_1 = require("./fraudchecker/fraudchecker.module");
const cartproducts_module_1 = require("./cartproducts/cartproducts.module");
const banner_module_1 = require("./banner/banner.module");
const promocode_module_1 = require("./promocode/promocode.module");
const setting_module_1 = require("./setting/setting.module");
const help_module_1 = require("./help/help.module");
const systemuser_module_1 = require("./systemuser/systemuser.module");
const earnings_module_1 = require("./earnings/earnings.module");
const overview_module_1 = require("./overview/overview.module");
const notifications_module_1 = require("./notifications/notifications.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const privecy_policy_module_1 = require("./privecy-policy/privecy-policy.module");
const trems_condetions_module_1 = require("./trems-condetions/trems-condetions.module");
const refund_policy_module_1 = require("./refund-policy/refund-policy.module");
const reviews_module_1 = require("./reviews/reviews.module");
const migration_controller_1 = require("./migration.controller");
const health_module_1 = require("./health/health.module");
const tracking_module_1 = require("./tracking/tracking.module");
const package_module_1 = require("./package/package.module");
const invoice_module_1 = require("./invoice/invoice.module");
const theme_module_1 = require("./theme/theme.module");
const superadmin_module_1 = require("./superadmin/superadmin.module");
const sale_invoice_module_1 = require("./sale-invoice/sale-invoice.module");
const credit_note_module_1 = require("./credit-note/credit-note.module");
const media_module_1 = require("./media/media.module");
const reseller_module_1 = require("./reseller/reseller.module");
const cash_module_1 = require("./cash/cash.module");
const top_products_module_1 = require("./top-products/top-products.module");
const voice_module_1 = require("./voice/voice.module");
const _1679999999999_AddSubdomainEnabledToSystemUser_1 = require("./migrations/1679999999999-AddSubdomainEnabledToSystemUser");
const _1739180000000_CustomDomainAutoVerification_1 = require("./migrations/1739180000000-CustomDomainAutoVerification");
const _1744000000000_AddPendingStatusToProducts_1 = require("./migrations/1744000000000-AddPendingStatusToProducts");
const _1771259405000_FixUserEmailUniqueConstraint_1 = require("./migrations/1771259405000-FixUserEmailUniqueConstraint");
const _1775562076955_addPaidFields_1 = require("./migrations/1775562076955-addPaidFields");
const _1775570000000_EnsurePaidFieldsOnSystemUsers_1 = require("./migrations/1775570000000-EnsurePaidFieldsOnSystemUsers");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            cache_manager_1.CacheModule.register({
                isGlobal: true,
                ttl: 300,
            }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                url: process.env.DATABASE_URL,
                synchronize: false,
                logging: false,
                ssl: {
                    rejectUnauthorized: false,
                },
                autoLoadEntities: true,
                migrations: [
                    _1679999999999_AddSubdomainEnabledToSystemUser_1.AddSubdomainEnabledToSystemUser1679999999999,
                    _1739180000000_CustomDomainAutoVerification_1.CustomDomainAutoVerification1739180000000,
                    _1744000000000_AddPendingStatusToProducts_1.AddPendingStatusToProducts1744000000000,
                    _1771259405000_FixUserEmailUniqueConstraint_1.FixUserEmailUniqueConstraint1771259405000,
                    _1775562076955_addPaidFields_1.AddPaidFields1775562076955,
                    _1775570000000_EnsurePaidFieldsOnSystemUsers_1.EnsurePaidFieldsOnSystemUsers1775570000000,
                ],
                migrationsRun: true,
                migrationsTransactionMode: 'each',
            }),
            typeorm_1.TypeOrmModule.forFeature([systemuser_entity_1.SystemUser]),
            schedule_1.ScheduleModule.forRoot(),
            category_module_1.CategoryModule,
            products_module_1.ProductModule,
            orders_module_1.OrdersModule,
            users_module_1.UsersModule,
            payments_module_1.PaymentsModule,
            fraudchecker_module_1.FraudcheckerModule,
            cartproducts_module_1.CartproductsModule,
            banner_module_1.BannerModule,
            promocode_module_1.PromocodeModule,
            setting_module_1.SettingModule,
            help_module_1.HelpModule,
            systemuser_module_1.SystemuserModule,
            earnings_module_1.EarningsModule,
            overview_module_1.OverviewModule,
            notifications_module_1.NotificationsModule,
            dashboard_module_1.DashboardModule,
            privecy_policy_module_1.PrivecyPolicyModule,
            trems_condetions_module_1.TremsCondetionsModule,
            refund_policy_module_1.RefundPolicyModule,
            reviews_module_1.ReviewsModule,
            health_module_1.HealthModule,
            tracking_module_1.TrackingModule,
            package_module_1.PackageModule,
            invoice_module_1.InvoiceModule,
            theme_module_1.ThemeModule,
            superadmin_module_1.SuperadminModule,
            sale_invoice_module_1.SaleInvoiceModule,
            credit_note_module_1.CreditNoteModule,
            media_module_1.MediaModule,
            reseller_module_1.ResellerModule,
            top_products_module_1.TopProductsModule,
            cash_module_1.CashModule,
            voice_module_1.VoiceModule,
        ],
        controllers: [app_controller_1.AppController, migration_controller_1.MigrationController],
        providers: [
            app_service_1.AppService,
            {
                provide: 'MAILER_TRANSPORT',
                inject: [config_1.ConfigService, setting_service_1.SettingService],
                useFactory: (config, settingService) => {
                    let cached;
                    const buildKey = (s) => [s.smtpUser, s.smtpPass].join('|');
                    const buildTransport = (s) => (0, nodemailer_1.createTransport)({
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
                        async sendMail(options) {
                            let setting;
                            try {
                                if (options?.companyId) {
                                    setting = await settingService.findFirstByCompanyId(options.companyId);
                                }
                                if (!setting) {
                                    setting = await settingService.findFirstByCompanyId('__SUPERADMIN_SMTP__');
                                }
                            }
                            catch {
                                try {
                                    setting = await settingService.findFirst();
                                }
                                catch {
                                }
                            }
                            const smtpUser = setting?.smtpUser ?? config.get('SMTP_USER');
                            const smtpPass = setting?.smtpPass ?? config.get('SMTP_PASS');
                            if (!smtpUser || !smtpPass) {
                                throw new Error('SMTP is not configured. Set SMTP in Settings (frontend) or provide SMTP_USER/SMTP_PASS env vars.');
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
                            const from = options?.from ?? smtpUser;
                            return cached.transport.sendMail({ ...options, from });
                        },
                    };
                },
            },
        ],
        exports: ['MAILER_TRANSPORT'],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map