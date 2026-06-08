import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ProductEntity } from '../products/entities/product.entity';
import {
  ResellerPayout,
  ResellerPayoutStatus,
} from './entities/reseller-payout.entity';
import { SystemUser } from '../systemuser/entities/systemuser.entity';
import { SystemUserRole } from '../systemuser/system-user-role.enum';
import { ConfigService } from '@nestjs/config';
import { RequestPayoutDto } from './dto/request-payout.dto';

@Injectable()
export class ResellerService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ResellerPayout)
    private readonly payoutRepo: Repository<ResellerPayout>,
    @InjectRepository(SystemUser)
    private readonly systemUserRepo: Repository<SystemUser>,
    private readonly configService: ConfigService,
    @Inject('MAILER_TRANSPORT')
    private readonly mailer: { sendMail: (message: any) => Promise<{ id?: string }> },
  ) {}

  async getSummary(resellerId: number, companyId: string) {
    const totalProducts = await this.productRepo.count({
      where: { resellerId, companyId },
    });

    // Aggregate reseller product performance
    const salesAgg = await this.productRepo
      .createQueryBuilder('product')
      .select('COALESCE(SUM(product.sold), 0)', 'totalSoldQty')
      .addSelect('COALESCE(SUM(product.totalIncome), 0)', 'totalRevenue')
      .where('product.resellerId = :resellerId', { resellerId })
      .andWhere('product.companyId = :companyId', { companyId })
      .getRawOne<{ totalSoldQty: string; totalRevenue: string }>();

    // Load reseller to get admin-defined commission % and paid totals
    const reseller = await this.systemUserRepo.findOne({
      where: { id: resellerId },
    });
    const commissionRate =
      reseller?.resellerCommissionRate != null
        ? Number(reseller.resellerCommissionRate)
        : 0;

    const totalSoldQty = Math.max(Number(salesAgg?.totalSoldQty ?? 0), 0);
    const totalRevenue = Math.max(Number(salesAgg?.totalRevenue ?? 0) - Number(reseller?.paidTotalEarning ?? 0), 0);

    // Admin takes commissionRate% from reseller's total revenue
    const totalCommission = (totalRevenue * commissionRate) / 100;

    // Reseller's net earning = total revenue minus admin commission
    const resellerNetEarning = totalRevenue - totalCommission;

    // Sum of payouts already paid TO the reseller by admin
    const paidPayouts = await this.payoutRepo
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(payout.amount), 0)', 'paid')
      .where('payout.resellerId = :resellerId', { resellerId })
      .andWhere('payout.companyId = :companyId', { companyId })
      .andWhere('payout.status = :status', {
        status: ResellerPayoutStatus.PAID,
      })
      .getRawOne<{ paid: string }>();

    const totalPaidToReseller = Number(paidPayouts?.paid ?? 0);

    // Since total sales are reset to 0 after every payout, totalRevenue only reflects the current unpaid cycle.
    // Therefore, pendingPayoutAmount is exactly the resellerNetEarning of the current cycle.
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

  async listPayouts(resellerId: number, companyId: string) {
    return this.payoutRepo.find({
      where: { resellerId, companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async requestPayout(
    resellerId: number,
    companyId: string,
    dto: RequestPayoutDto,
  ) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recent = await this.payoutRepo.findOne({
      where: {
        resellerId,
        companyId,
        createdAt: MoreThanOrEqual(sevenDaysAgo),
      },
      order: { createdAt: 'DESC' },
    });

    if (recent) {
      throw new BadRequestException(
        'Payment request allowed once every 7 days.',
      );
    }

    const summary = await this.getSummary(resellerId, companyId);
    if (summary.pendingPayoutAmount <= 0) {
      throw new BadRequestException('No payable amount available.');
    }

    const payout = this.payoutRepo.create({
      resellerId,
      companyId,
      amount: summary.pendingPayoutAmount,
      status: ResellerPayoutStatus.PENDING,
      paymentDetails: dto.paymentDetails.trim(),
    });

    const saved = await this.payoutRepo.save(payout);

    // Notify admin that reseller has submitted a withdrawal request
    try {
      const reseller = await this.systemUserRepo.findOne({
        where: { id: resellerId },
      });
      const adminEmail =
        this.configService.get<string>('RESELLER_ADMIN_EMAIL') ||
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
    } catch (error) {
      console.error('Failed to send admin withdrawal notification:', error);
    }

    return saved;
  }

  /**
   * Admin: create a commission payout request for a reseller.
   * Uses the same 7-day cooldown and pending amount logic as reseller-initiated requests.
   */
  async adminCreatePayout(
    resellerId: number,
    companyId: string,
    dto: RequestPayoutDto,
  ) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recent = await this.payoutRepo.findOne({
      where: {
        resellerId,
        companyId,
        createdAt: MoreThanOrEqual(sevenDaysAgo),
      },
      order: { createdAt: 'DESC' },
    });

    if (recent) {
      throw new BadRequestException(
        'Commission request allowed once every 7 days for this reseller.',
      );
    }

    const summary = await this.getSummary(resellerId, companyId);

    // Allow admin to override commission rate for this particular payout
    const effectiveRate =
      dto.commissionRate != null
        ? Number(dto.commissionRate)
        : summary.commissionRate;

    const baseRevenue = summary.totalEarning;
    const calculatedAmount = (baseRevenue * effectiveRate) / 100;

    if (calculatedAmount <= 0) {
      throw new BadRequestException('No commission due for this reseller.');
    }

    const payout = this.payoutRepo.create({
      resellerId,
      companyId,
      amount: calculatedAmount,
      status: ResellerPayoutStatus.PENDING,
      // Admin provides bank/bKash/etc. instructions for the reseller
      paymentDetails: dto.paymentDetails.trim(),
    });

    const saved = await this.payoutRepo.save(payout);

    // Notify reseller by email that a new commission request is created
    try {
      const reseller = await this.systemUserRepo.findOne({
        where: { id: resellerId },
      });
      if (reseller?.email) {
        const loginUrl =
          this.configService.get<string>('RESELLER_LOGIN_URL') ||
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
          ${
            saved.paymentDetails
              ? `<p><strong>Payment instructions from admin:</strong></p><pre>${saved.paymentDetails}</pre>`
              : ''
          }
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
    } catch (error) {
      console.error('Failed to send reseller commission request email:', error);
      // Do not throw – request creation should still succeed
    }

    return saved;
  }

  /** Reseller: mark a payout/commission invoice as paid (after sending money to admin) */
  async resellerMarkPayoutPaid(
    payoutId: number,
    resellerId: number,
    companyId: string,
  ) {
    const payout = await this.payoutRepo.findOne({
      where: { id: payoutId, resellerId, companyId },
    });
    if (!payout) {
      throw new BadRequestException('Payout not found');
    }
    if (payout.status === ResellerPayoutStatus.PAID) {
      throw new BadRequestException('Payout already marked as paid');
    }

    payout.status = ResellerPayoutStatus.PAID;
    payout.paidAt = new Date();
    if (!payout.invoiceNumber) {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      payout.invoiceNumber = `RP-INV-${payout.companyId}-${payout.id}-${yyyy}${mm}${dd}`;
    }

    const saved = await this.payoutRepo.save(payout);

    // Notify platform admin by email that reseller has approved a commission payout
    try {
      const reseller = await this.systemUserRepo.findOne({
        where: { id: resellerId },
      });

      const adminEmail =
        this.configService.get<string>('RESELLER_ADMIN_EMAIL') ||
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
    } catch (error) {
      console.error('Failed to send admin notification for reseller payout:', error);
      // Do not throw – payout marking should still succeed
    }

    return saved;
  }

  async adminListPayouts(companyId?: string) {
    const qb = this.payoutRepo
      .createQueryBuilder('payout')
      .orderBy('payout.createdAt', 'DESC');

    if (companyId) {
      qb.where('payout.companyId = :companyId', { companyId });
    }

    return qb.getMany();
  }

  async markPayoutPaid(id: number) {
    const payout = await this.payoutRepo.findOne({ where: { id } });
    if (!payout) {
      throw new BadRequestException('Payout not found');
    }
    payout.status = ResellerPayoutStatus.PAID;
    payout.paidAt = new Date();
    if (!payout.invoiceNumber) {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      payout.invoiceNumber = `RP-INV-${payout.companyId}-${id}-${yyyy}${mm}${dd}`;
    }
    const saved = await this.payoutRepo.save(payout);

    // Instead of resetting products, we update the reseller's snapshot of paid sales
    const salesAgg = await this.productRepo
      .createQueryBuilder('product')
      .select('COALESCE(SUM(product.sold), 0)', 'totalSoldQty')
      .addSelect('COALESCE(SUM(product.totalIncome), 0)', 'totalRevenue')
      .where('product.resellerId = :resellerId', { resellerId: saved.resellerId })
      .andWhere('product.companyId = :companyId', { companyId: saved.companyId })
      .getRawOne<{ totalSoldQty: string; totalRevenue: string }>();

    await this.systemUserRepo.update(
      { id: saved.resellerId },
      { 
        paidTotalEarning: Number(salesAgg?.totalRevenue ?? 0) 
      }
    );

    // Notify reseller by email (best-effort)
    try {
      const reseller = await this.systemUserRepo.findOne({
        where: { id: saved.resellerId },
      });
      if (reseller?.email) {
        const loginUrl =
          this.configService.get<string>('RESELLER_LOGIN_URL') ||
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
    } catch (error) {
      console.error('Failed to send reseller payout email:', error);
      // Do not throw – payout marking should still succeed
    }

    return saved;
  }

  /** Reseller: get invoice data for a paid payout (own payouts only) */
  async getPayoutInvoice(
    payoutId: number,
    resellerId: number,
    companyId: string,
  ) {
    const payout = await this.payoutRepo.findOne({
      where: { id: payoutId, resellerId, companyId },
    });
    if (!payout) {
      throw new BadRequestException('Payout not found');
    }
    if (payout.status !== ResellerPayoutStatus.PAID) {
      throw new BadRequestException('Invoice is available only for paid payouts');
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

  /** Admin: get invoice data for a paid payout (any reseller within the company) */
  async adminGetPayoutInvoice(payoutId: number, companyId: string) {
    const payout = await this.payoutRepo.findOne({
      where: { id: payoutId, companyId },
    });
    if (!payout) {
      throw new BadRequestException('Payout not found');
    }
    if (payout.status !== ResellerPayoutStatus.PAID) {
      throw new BadRequestException('Invoice is available only for paid payouts');
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

  /** Admin: list all resellers for company with stats and payout requests */
  async adminResellersList(companyId?: string) {
    const qb = this.systemUserRepo
      .createQueryBuilder('u')
      .where('u.role = :role', { role: SystemUserRole.RESELLER })
      .orderBy('u.name', 'ASC');

    if (companyId) {
      qb.andWhere('u.companyId = :companyId', { companyId });
    }

    const resellers = await qb.getMany();

    const result = await Promise.all(
      resellers.map(async (u) => {
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
      }),
    );

    return result;
  }

  /** Admin: approve a reseller (activate their account) */
  async approveReseller(id: number) {
    const reseller = await this.systemUserRepo.findOne({
      where: { id, role: SystemUserRole.RESELLER },
    });
    if (!reseller) {
      throw new BadRequestException('Reseller not found');
    }
    if (!reseller.isActive) {
      reseller.isActive = true;
    }
    const saved = await this.systemUserRepo.save(reseller);

    // Send approval email with login URL
    try {
      const loginUrl =
        this.configService.get<string>('RESELLER_LOGIN_URL') ||
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
    } catch (error) {
      console.error('Failed to send reseller approval email:', error);
      // Do not throw – approval should still succeed
    }

    return saved;
  }

  /** Admin: delete (soft-remove) a reseller */
  async deleteReseller(id: number) {
    const reseller = await this.systemUserRepo.findOne({
      where: { id, role: SystemUserRole.RESELLER },
    });
    if (!reseller) {
      throw new BadRequestException('Reseller not found');
    }
    await this.systemUserRepo.softRemove(reseller);
    return { id };
  }
}

