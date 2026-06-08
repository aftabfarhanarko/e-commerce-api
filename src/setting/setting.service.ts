import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpdateSmtpDto } from './dto/update-smtp.dto';
import { UpdateOrderReceiptUrlDto } from './dto/update-order-receipt-url.dto';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}
  create(createSettingDto: CreateSettingDto) {
    const entity = this.settingRepo.create(createSettingDto);
    return this.settingRepo.save(entity);
  }

  async findAll() {
    return this.settingRepo.find();
  }

  async findFirstByCompanyId(companyId: string) {
    const entity = await this.settingRepo.findOne({
      where: { companyId },
      order: { id: 'ASC' },
    });
    if (!entity) throw new NotFoundException('No settings found');
    return entity;
  }

  async findFirst() {
    const entity = await this.settingRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!entity) throw new NotFoundException('No settings found');
    return entity;
  }

  async upsertSmtp(companyId: string, dto: UpdateSmtpDto) {
    let entity: Setting | null = null;
    try {
      entity = await this.settingRepo.findOne({
        where: { companyId },
        order: { id: 'ASC' },
      });
    } catch {
      entity = null;
    }

    if (!entity) {
      const smtpUser = dto.smtpUser?.trim() || '';
      const created = this.settingRepo.create({
        companyId,
        companyName: 'Default',
        email: smtpUser || 'noreply@example.com',
        smtpUser: smtpUser || null,
        smtpPass: dto.smtpPass ?? null,
      } as Partial<Setting>);
      return this.settingRepo.save(created);
    }

    const merged = this.settingRepo.merge(entity, {
      smtpUser: dto.smtpUser?.trim() || null,
      smtpPass: dto.smtpPass ?? null,
    });
    return this.settingRepo.save(merged);
  }

  async findOne(id: number) {
    const entity = await this.settingRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Setting ${id} not found`);
    return entity;
  }

  async update(id: number, updateSettingDto: UpdateSettingDto) {
    const entity = await this.findOne(id);
    const merged = this.settingRepo.merge(entity, updateSettingDto);
    return this.settingRepo.save(merged);
  }

  async remove(id: number) {
    const entity = await this.findOne(id);
    await this.settingRepo.softRemove(entity);
    return { success: true };
  }


  async upsertOrderReceiptUrl(companyId: string, dto: UpdateOrderReceiptUrlDto) {
    let entity: Setting | null = null;
    try {
      entity = await this.settingRepo.findOne({
        where: { companyId },
        order: { id: 'ASC' },
      });
    } catch {
      entity = null;
    }

    if (!entity) {
      const created = this.settingRepo.create({
        companyId,
        companyName: 'Default',
        email: 'noreply@example.com',
        orderReceiptUrl: dto.orderReceiptUrl ?? null,
      } as Partial<Setting>);
      return this.settingRepo.save(created);
    }

    const merged = this.settingRepo.merge(entity, {
      orderReceiptUrl: dto.orderReceiptUrl ?? null,
    });
    return this.settingRepo.save(merged);
  }

  async getOrderReceiptUrl(companyId: string): Promise<string | null> {
    const entity = await this.settingRepo.findOne({
      where: { companyId },
      order: { id: 'ASC' },
    });
    return entity?.orderReceiptUrl ?? null;
  }
}
