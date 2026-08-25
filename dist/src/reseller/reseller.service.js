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
exports.ResellerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const product_entity_1 = require("../products/entities/product.entity");
const reseller_payout_entity_1 = require("./entities/reseller-payout.entity");
const systemuser_entity_1 = require("../systemuser/entities/systemuser.entity");
const system_user_role_enum_1 = require("../systemuser/system-user-role.enum");
const config_1 = require("@nestjs/config");
let ResellerService = class ResellerService {
    constructor(productRepo, payoutRepo, systemUserRepo, configService, mailer) {
        this.productRepo = productRepo;
        this.payoutRepo = payoutRepo;
        this.systemUserRepo = systemUserRepo;
        this.configService = configService;
        this.mailer = mailer;
    }
    async getSummary(resellerId, companyId) {
        const totalProducts = await this.productRepo.count({
            where: { resellerId, companyId },
        });
        const salesAgg = await this.productRepo
            .createQueryBuilder('product')
            .select('COALESCE(SUM(product.sold), 0)', 'totalSoldQty')
            .addSelect('COALESCE(SUM(product.totalIncome), 0)', 'totalRevenue')
            .where('product.resellerId = :resellerId', { resellerId })
            .andWhere('product.companyId = :companyId', { companyId })
            .getRawOne();
        const reseller = await this.systemUserRepo.findOne({
            where: { id: resellerId },
        });
        const commissionRate = reseller?.resellerCommissionRate != null
            ? Number(reseller.resellerCommissionRate)
            : 0;
        const totalSoldQty = Math.max(Number(salesAgg?.totalSoldQty ?? 0), 0);
        const totalRevenue = Math.max(Number(salesAgg?.totalRevenue ?? 0) - Number(reseller?.paidTotalEarning ?? 0), 0);
        const totalCommission = (totalRevenue * commissionRate) / 100;
        const resellerNetEarning = totalRevenue - totalCommission;
        const paidPayouts = await this.payoutRepo
            .createQueryBuilder('payout')
            .select('COALESCE(SUM(payout.amount), 0)', 'paid')
            .where('payout.resellerId = :resellerId', { resellerId })
            .andWhere('payout.companyId = :companyId', { companyId })
            .andWhere('payout.status = :status', {
            status: reseller_payout_entity_1.ResellerPayoutStatus.PAID,
        })
            .getRawOne();
        const totalPaidToReseller = Number(paidPayouts?.paid ?? 0);
        const pendingPayoutAmount = Math.max(resellerNetEarning, 0);
        return {
            totalProducts,
            totalSoldQty,
            totalEarning: totalRevenue,
            commissionRate,
            totalCommission,
            resellerNetEarning,
            pendingPayoutAmount,
            totalWithdrawn: totalPaidToReseller,
        };
    }
    async listPayouts(resellerId, companyId) {
        return this.payoutRepo.find({
            where: { resellerId, companyId },
            order: { createdAt: 'DESC' },
        });
    }
    async requestPayout(resellerId, companyId, dto) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = await this.payoutRepo.findOne({
            where: {
                resellerId,
                companyId,
                createdAt: (0, typeorm_2.MoreThanOrEqual)(sevenDaysAgo),
            },
            order: { createdAt: 'DESC' },
        });
        if (recent) {
            throw new common_1.BadRequestException('Payment request allowed once every 7 days.');
        }
        const summary = await this.getSummary(resellerId, companyId);
        if (summary.pendingPayoutAmount <= 0) {
            throw new common_1.BadRequestException('No payable amount available.');
        }
        const payout = this.payoutRepo.create({
            resellerId,
            companyId,
            amount: summary.pendingPayoutAmount,
            status: reseller_payout_entity_1.ResellerPayoutStatus.PENDING,
            paymentDetails: dto.paymentDetails.trim(),
        });
        const saved = await this.payoutRepo.save(payout);
        try {
            const reseller = await this.systemUserRepo.findOne({
                where: { id: resellerId },
            });
            const adminEmail = this.configService.get('RESELLER_ADMIN_EMAIL') ||
                'xinxo.shop@gmail.com';
            if (adminEmail) {
                const amount = Number(saved.amount).toFixed(2);
                const html = `
          <p>Dear Admin,</p>
          <p>A reseller has submitted a <strong>new withdrawal request</strong> that requires your review.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li><strong>Reseller:</strong> ${reseller?.name ?? 'N/A'} (${reseller?.email ?? 'N/A'})</li>
            <li><strong>Payout ID:</strong> ${saved.id}</li>
            <li><strong>Amount:</strong> ${amount}</li>
            <li><strong>Payment details provided by reseller:</strong></li>
          </ul>
          <pre>${saved.paymentDetails}</pre>
          <p>Please log in to the admin panel, go to <strong>Resellers</strong>, expand this reseller's payouts, and click <strong>Mark as Paid</strong> once you have transferred the amount.</p>
        `;
                await this.mailer.sendMail({
                    companyId,
                    to: adminEmail,
                    subject: 'New reseller withdrawal request submitted',
                    html,
                });
            }
        }
        catch (error) {
            console.error('Failed to send admin withdrawal notification:', error);
        }
        return saved;
    }
    async adminCreatePayout(resellerId, companyId, dto) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = await this.payoutRepo.findOne({
            where: {
                resellerId,
                companyId,
                createdAt: (0, typeorm_2.MoreThanOrEqual)(sevenDaysAgo),
            },
            order: { createdAt: 'DESC' },
        });
        if (recent) {
            throw new common_1.BadRequestException('Commission request allowed once every 7 days for this reseller.');
        }
        const summary = await this.getSummary(resellerId, companyId);
        const effectiveRate = dto.commissionRate != null
            ? Number(dto.commissionRate)
            : summary.commissionRate;
        const baseRevenue = summary.totalEarning;
        const calculatedAmount = (baseRevenue * effectiveRate) / 100;
        if (calculatedAmount <= 0) {
            throw new common_1.BadRequestException('No commission due for this reseller.');
        }
        const payout = this.payoutRepo.create({
            resellerId,
            companyId,
            amount: calculatedAmount,
            status: reseller_payout_entity_1.ResellerPayoutStatus.PENDING,
            paymentDetails: dto.paymentDetails.trim(),
        });
        const saved = await this.payoutRepo.save(payout);
        try {
            const reseller = await this.systemUserRepo.findOne({
                where: { id: resellerId },
            });
            if (reseller?.email) {
                const loginUrl = this.configService.get('RESELLER_LOGIN_URL') ||
                    'https://www.fiberace.shop';
                const amount = Number(saved.amount).toFixed(2);
                const requestedAt = saved.createdAt
                    ? saved.createdAt.toISOString().slice(0, 19).replace('T', ' ')
                    : '';
                const html = `
          <p>Hi ${reseller.name || 'there'},</p>
          <p>A new <strong>commission payment request</strong> has been generated for your reseller account.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li><strong>Payout ID:</strong> ${saved.id}</li>
            <li><strong>Amount:</strong> ${amount}</li>
            <li><strong>Requested at:</strong> ${requestedAt}</li>
          </ul>
          ${saved.paymentDetails
                    ? `<p><strong>Payment instructions from admin:</strong></p><pre>${saved.paymentDetails}</pre>`
                    : ''}
          <p>You can log in to your reseller dashboard to review this commission request and mark it as paid after you send the payment:</p>
          <p><a href="${loginUrl}">${loginUrl}</a></p>
        `;
                await this.mailer.sendMail({
                    companyId,
                    to: reseller.email,
                    subject: 'New commission payment request for your reseller account',
                    html,
                });
            }
        }
        catch (error) {
            console.error('Failed to send reseller commission request email:', error);
        }
        return saved;
    }
    async resellerMarkPayoutPaid(payoutId, resellerId, companyId) {
        const payout = await this.payoutRepo.findOne({
            where: { id: payoutId, resellerId, companyId },
        });
        if (!payout) {
            throw new common_1.BadRequestException('Payout not found');
        }
        if (payout.status === reseller_payout_entity_1.ResellerPayoutStatus.PAID) {
            throw new common_1.BadRequestException('Payout already marked as paid');
        }
        payout.status = reseller_payout_entity_1.ResellerPayoutStatus.PAID;
        payout.paidAt = new Date();
        if (!payout.invoiceNumber) {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            payout.invoiceNumber = `RP-INV-${payout.companyId}-${payout.id}-${yyyy}${mm}${dd}`;
        }
        const saved = await this.payoutRepo.save(payout);
        try {
            const reseller = await this.systemUserRepo.findOne({
                where: { id: resellerId },
            });
            const adminEmail = this.configService.get('RESELLER_ADMIN_EMAIL') ||
                'xinxo.shop@gmail.com';
            if (adminEmail) {
                const amount = Number(saved.amount).toFixed(2);
                const paidAt = saved.paidAt
                    ? saved.paidAt.toISOString().slice(0, 19).replace('T', ' ')
                    : '';
                const html = `
          <p>Dear Admin,</p>
          <p>A reseller has <strong>marked a commission payout as paid</strong>.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li><strong>Payout ID:</strong> ${saved.id}</li>
            <li><strong>Invoice:</strong> ${saved.invoiceNumber}</li>
            <li><strong>Amount:</strong> ${amount}</li>
            <li><strong>Paid at:</strong> ${paidAt}</li>
            <li><strong>Reseller:</strong> ${reseller?.name ?? 'Reseller'} (${reseller?.email ?? 'N/A'})</li>
            <li><strong>Company ID:</strong> ${saved.companyId}</li>
          </ul>
        `;
                await this.mailer.sendMail({
                    companyId,
                    to: adminEmail,
                    subject: 'Reseller commission payout marked as paid',
                    html,
                });
            }
        }
        catch (error) {
            console.error('Failed to send admin notification for reseller payout:', error);
        }
        return saved;
    }
    async adminListPayouts(companyId) {
        const qb = this.payoutRepo
            .createQueryBuilder('payout')
            .orderBy('payout.createdAt', 'DESC');
        if (companyId) {
            qb.where('payout.companyId = :companyId', { companyId });
        }
        return qb.getMany();
    }
    async markPayoutPaid(id) {
        const payout = await this.payoutRepo.findOne({ where: { id } });
        if (!payout) {
            throw new common_1.BadRequestException('Payout not found');
        }
        payout.status = reseller_payout_entity_1.ResellerPayoutStatus.PAID;
        payout.paidAt = new Date();
        if (!payout.invoiceNumber) {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            payout.invoiceNumber = `RP-INV-${payout.companyId}-${id}-${yyyy}${mm}${dd}`;
        }
        const saved = await this.payoutRepo.save(payout);
        const salesAgg = await this.productRepo
            .createQueryBuilder('product')
            .select('COALESCE(SUM(product.sold), 0)', 'totalSoldQty')
            .addSelect('COALESCE(SUM(product.totalIncome), 0)', 'totalRevenue')
            .where('product.resellerId = :resellerId', { resellerId: saved.resellerId })
            .andWhere('product.companyId = :companyId', { companyId: saved.companyId })
            .getRawOne();
        await this.systemUserRepo.update({ id: saved.resellerId }, {
            paidTotalEarning: Number(salesAgg?.totalRevenue ?? 0)
        });
        try {
            const reseller = await this.systemUserRepo.findOne({
                where: { id: saved.resellerId },
            });
            if (reseller?.email) {
                const loginUrl = this.configService.get('RESELLER_LOGIN_URL') ||
                    'https://www.fiberace.shop';
                const amount = Number(saved.amount).toFixed(2);
                const paidAt = saved.paidAt
                    ? saved.paidAt.toISOString().slice(0, 19).replace('T', ' ')
                    : '';
                const html = `
          <p>Hi ${reseller.name || 'there'},</p>
          <p>Your payout request has been <strong>marked as paid</strong>.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li><strong>Payout ID:</strong> ${saved.id}</li>
            <li><strong>Invoice:</strong> ${saved.invoiceNumber}</li>
            <li><strong>Amount:</strong> ${amount}</li>
            <li><strong>Paid at:</strong> ${paidAt}</li>
          </ul>
          <p>You can log in to your reseller dashboard to view the payout history and download the invoice:</p>
          <p><a href="${loginUrl}">${loginUrl}</a></p>
        `;
                await this.mailer.sendMail({
                    companyId: saved.companyId,
                    to: reseller.email,
                    subject: 'Your reseller payout has been paid',
                    html,
                });
            }
        }
        catch (error) {
            console.error('Failed to send reseller payout email:', error);
        }
        return saved;
    }
    async getPayoutInvoice(payoutId, resellerId, companyId) {
        const payout = await this.payoutRepo.findOne({
            where: { id: payoutId, resellerId, companyId },
        });
        if (!payout) {
            throw new common_1.BadRequestException('Payout not found');
        }
        if (payout.status !== reseller_payout_entity_1.ResellerPayoutStatus.PAID) {
            throw new common_1.BadRequestException('Invoice is available only for paid payouts');
        }
        const reseller = await this.systemUserRepo.findOne({
            where: { id: resellerId },
        });
        return {
            invoiceNumber: payout.invoiceNumber ?? `RP-INV-${payout.id}`,
            resellerName: reseller?.name ?? 'Reseller',
            resellerEmail: reseller?.email ?? '',
            companyName: reseller?.companyName ?? '',
            amount: Number(payout.amount),
            paidAt: payout.paidAt,
            requestedAt: payout.createdAt,
            payoutId: payout.id,
        };
    }
    async adminGetPayoutInvoice(payoutId, companyId) {
        const payout = await this.payoutRepo.findOne({
            where: { id: payoutId, companyId },
        });
        if (!payout) {
            throw new common_1.BadRequestException('Payout not found');
        }
        if (payout.status !== reseller_payout_entity_1.ResellerPayoutStatus.PAID) {
            throw new common_1.BadRequestException('Invoice is available only for paid payouts');
        }
        const reseller = await this.systemUserRepo.findOne({
            where: { id: payout.resellerId },
        });
        return {
            invoiceNumber: payout.invoiceNumber ?? `RP-INV-${payout.id}`,
            resellerName: reseller?.name ?? 'Reseller',
            resellerEmail: reseller?.email ?? '',
            companyName: reseller?.companyName ?? '',
            amount: Number(payout.amount),
            paidAt: payout.paidAt,
            requestedAt: payout.createdAt,
            payoutId: payout.id,
        };
    }
    async adminResellersList(companyId) {
        const qb = this.systemUserRepo
            .createQueryBuilder('u')
            .where('u.role = :role', { role: system_user_role_enum_1.SystemUserRole.RESELLER })
            .orderBy('u.name', 'ASC');
        if (companyId) {
            qb.andWhere('u.companyId = :companyId', { companyId });
        }
        const resellers = await qb.getMany();
        const result = await Promise.all(resellers.map(async (u) => {
            const summary = await this.getSummary(u.id, u.companyId);
            const payouts = await this.listPayouts(u.id, u.companyId);
            return {
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone ?? null,
                companyId: u.companyId,
                companyName: u.companyName ?? null,
                isActive: u.isActive,
                createdAt: u.createdAt,
                totalProducts: summary.totalProducts,
                totalSoldQty: summary.totalSoldQty,
                totalEarning: summary.totalEarning,
                commissionRate: summary.commissionRate,
                totalCommission: summary.totalCommission,
                pendingPayoutAmount: summary.pendingPayoutAmount,
                totalWithdrawn: summary.totalWithdrawn,
                payouts,
            };
        }));
        return result;
    }
    async approveReseller(id) {
        const reseller = await this.systemUserRepo.findOne({
            where: { id, role: system_user_role_enum_1.SystemUserRole.RESELLER },
        });
        if (!reseller) {
            throw new common_1.BadRequestException('Reseller not found');
        }
        if (!reseller.isActive) {
            reseller.isActive = true;
        }
        const saved = await this.systemUserRepo.save(reseller);
        try {
            const loginUrl = this.configService.get('RESELLER_LOGIN_URL') ||
                'https://www.fiberace.shop';
            const html = `
        <p>Hi ${saved.name || 'there'},</p>
        <p>Your reseller account has been <strong>approved</strong>.</p>
        <p>You can now log in using your email address:</p>
        <ul>
          <li><strong>Email:</strong> ${saved.email}</li>
          <li><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></li>
        </ul>
        <p>Your password was set by the store admin. If you don't know it yet, please contact them or use the password reset option on the login page.</p>
      `;
            await this.mailer.sendMail({
                companyId: saved.companyId,
                to: saved.email,
                subject: 'Your reseller account is approved',
                html,
            });
        }
        catch (error) {
            console.error('Failed to send reseller approval email:', error);
        }
        return saved;
    }
    async deleteReseller(id) {
        const reseller = await this.systemUserRepo.findOne({
            where: { id, role: system_user_role_enum_1.SystemUserRole.RESELLER },
        });
        if (!reseller) {
            throw new common_1.BadRequestException('Reseller not found');
        }
        await this.systemUserRepo.softRemove(reseller);
        return { id };
    }
};
exports.ResellerService = ResellerService;
exports.ResellerService = ResellerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.ProductEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(reseller_payout_entity_1.ResellerPayout)),
    __param(2, (0, typeorm_1.InjectRepository)(systemuser_entity_1.SystemUser)),
    __param(4, (0, common_1.Inject)('MAILER_TRANSPORT')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService, Object])
], ResellerService);
//# sourceMappingURL=reseller.service.js.map