import { Injectable, BadRequestException, NotFoundException, UnauthorizedException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuperAdmin } from './entities/superadmin.entity';
import { CreateSuperadminDto } from './dto/create-superadmin.dto';
import { SuperadminLoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { Transporter } from 'nodemailer';

@Injectable()
export class SuperadminService {
  constructor(
    @InjectRepository(SuperAdmin)
    private readonly superadminRepo: Repository<SuperAdmin>,
    private readonly jwtService: JwtService,
    @Inject('MAILER_TRANSPORT')
    private readonly mailer: Transporter,
  ) {}

  private hashPassword(password: string, salt: string): string {
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
  }

  async create(dto: CreateSuperadminDto) {
    // Check if superadmin with same email already exists
    const exists = await this.superadminRepo.findOne({ 
      where: { email: dto.email } 
    });
    if (exists) {
      throw new BadRequestException('Superadmin with this email already exists');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(dto.password, salt);

    const permissions = dto.permissions || [];

    const entity = this.superadminRepo.create({
      name: dto.name,
      email: dto.email,
      designation: dto.designation || null,
      photo: dto.photo || null,
      passwordSalt: salt,
      passwordHash: hash,
      permissions,
      role: 'SUPER_ADMIN',
      isActive: true,
    } as Partial<SuperAdmin>);

    await this.superadminRepo.save(entity);

    // Send login credentials to the new superadmin's email (HTML template)
    if (dto.email) {
      const loginUrl = 'https://console.innowavecart.app/login';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Super Admin Account</title>
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;background:radial-gradient(circle at top,#f5f5f5,#000000 55%);">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#020617;border-radius:18px;overflow:hidden;border:1px solid rgba(148,163,184,0.6);">
          <tr>
            <td style="background:radial-gradient(circle at 0% 0%,#f5f5f5,#111111);padding:22px 26px 18px;text-align:left;color:#f5f5f5;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#e0e7ff;opacity:0.9;">
                NexoviaSoft · Super Admin
              </div>
              <h1 style="margin:6px 0 0;font-size:22px;font-weight:600;color:#eef2ff;">
                Your Super Admin account is ready
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 26px 26px;">
              <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#9ca3af;">
                Hi <span style="color:#e5e7eb;font-weight:500;">${dto.name}</span>,
              </p>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#9ca3af;">
                Your <span style="color:#a5b4fc;font-weight:500;">NexoviaSoft Super Admin</span> account has been created successfully. 
                Use the credentials below to sign in to your dashboard.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617;border-radius:14px;margin-bottom:18px;border:1px solid rgba(55,65,81,0.9);">
                <tr>
                  <td style="padding:18px 20px 16px;">
                    <h2 style="margin:0 0 10px;font-size:15px;color:#c4b5fd;">
                      Login details
                    </h2>
                    <table width="100%" cellpadding="6" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#9ca3af;">Email</td>
                        <td style="font-size:13px;color:#e5e7eb;font-weight:500;text-align:right;">
                          ${dto.email}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#9ca3af;padding-top:6px;">Temporary password</td>
                        <td style="font-size:13px;color:#e5e7eb;font-weight:500;text-align:right;padding-top:6px;">
                          ${dto.password}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display:inline-block;padding:11px 22px;border-radius:999px;background:linear-gradient(to right,#ffffff,#111111);color:#000000;font-size:14px;font-weight:500;text-decoration:none;box-shadow:0 12px 30px rgba(0,0,0,0.45);">
                      Go to Super Admin Login
                    </a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(15,23,42,0.9);border-radius:14px;border:1px solid rgba(55,65,81,0.9);">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#e5e7eb;font-weight:500;">
                      Security tip
                    </p>
                    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                      For your security, please sign in and <span style="color:#000000;font-weight:500;">change this temporary password</span> immediately from your profile settings.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#020617;padding:14px 26px 18px;text-align:center;border-top:1px solid rgba(55,65,81,0.9);">
              <p style="margin:0 0 4px;font-size:11px;color:#6b7280;">
                This is an automated message from NexoviaSoft.
              </p>
              <p style="margin:0;font-size:11px;color:#6b7280;">
                © ${new Date().getFullYear()} NexoviaSoft. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      try {
        await this.mailer.sendMail({
          from: '"NexoviaSoft HQ" <innowavecarthq@gmail.com>',
          to: dto.email,
          subject: 'Your NexoviaSoft Super Admin account',
          text: `Your NexoviaSoft Super Admin account is ready.\nEmail: ${dto.email}\nPassword: ${dto.password}\nLogin: ${loginUrl}`,
          html,
        });
      } catch (err) {
        // Do not block creation if email sending fails
        // eslint-disable-next-line no-console
        console.error('[SuperadminService] Failed to send credentials email:', err);
      }
    }

    const { passwordHash, passwordSalt, ...safe } = entity as any;
    return safe;
  }

  async findByEmail(email: string) {
    return this.superadminRepo
      .createQueryBuilder('superadmin')
      .where('LOWER(superadmin.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
  }

  async findAll() {
    const list = await this.superadminRepo.find({ 
      order: { id: 'DESC' },
    });
    return list.map(({ passwordHash, passwordSalt, ...safe }) => safe);
  }

  async findOne(id: number) {
    const entity = await this.superadminRepo.findOne({ 
      where: { id },
    });
    if (!entity) throw new NotFoundException('Superadmin not found');
    const { passwordHash, passwordSalt, ...safe } = entity as any;
    return safe;
  }

  async update(id: number, dto: Partial<CreateSuperadminDto>) {
    const entity = await this.superadminRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Superadmin not found');

    if (dto.name !== undefined) {
      entity.name = dto.name;
    }

    if (dto.email !== undefined) {
      // Check if email is being changed and if new email already exists
      if (dto.email !== entity.email) {
        const exists = await this.superadminRepo.findOne({ 
          where: { email: dto.email } 
        });
        if (exists) {
          throw new BadRequestException('Superadmin with this email already exists');
        }
        entity.email = dto.email;
      }
    }

    if (dto.designation !== undefined) entity.designation = dto.designation;
    if (dto.photo !== undefined) entity.photo = dto.photo;
    if (dto.permissions !== undefined) entity.permissions = dto.permissions;

    if (dto.password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = this.hashPassword(dto.password, salt);
      entity.passwordSalt = salt;
      entity.passwordHash = hash;
    }

    await this.superadminRepo.save(entity);

    const { passwordHash, passwordSalt, ...safe } = entity as any;
    return safe;
  }

  async remove(id: number) {
    const entity = await this.superadminRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Superadmin not found');
    await this.superadminRepo.softRemove(entity);
    return { success: true };
  }

  async login(dto: SuperadminLoginDto) {
    // Normalize email: trim and lowercase for case-insensitive lookup
    const normalizedEmail = dto.email?.trim().toLowerCase();
    
    if (!normalizedEmail) {
      throw new UnauthorizedException('Email is required');
    }
    
    if (!dto.password) {
      throw new UnauthorizedException('Password is required');
    }
    
    // Use case-insensitive email lookup using query builder
    const superadmin = await this.superadminRepo
      .createQueryBuilder('superadmin')
      .where('LOWER(superadmin.email) = LOWER(:email)', { email: normalizedEmail })
      .getOne();
    
    if (!superadmin) {
      console.log(`[Superadmin Login] User not found for email: ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const hash = this.hashPassword(dto.password, superadmin.passwordSalt);
    if (hash !== superadmin.passwordHash) {
      console.log(`[Superadmin Login] Password mismatch for email: ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!superadmin.isActive) {
      throw new BadRequestException('Account is inactive');
    }

    const payload = {
      sub: superadmin.id,
      userId: superadmin.id,
      name: superadmin.name,
      email: superadmin.email,
      designation: superadmin.designation,
      photo: superadmin.photo,
      permissions: superadmin.permissions || [],
      role: superadmin.role,
      isActive: superadmin.isActive,
      createdAt: superadmin.createdAt,
      updatedAt: superadmin.updatedAt,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '24d' });
    const refreshToken = this.jwtService.sign(
      { sub: superadmin.id, userId: superadmin.id },
      { expiresIn: '24d' }
    );

    const { passwordHash, passwordSalt, ...safe } = superadmin as any;
    return { accessToken, refreshToken, user: safe };
  }
}
