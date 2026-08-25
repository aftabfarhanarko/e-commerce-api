import { SettingService } from './setting.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { RequestContextService } from '../common/services/request-context.service';
import { UpdateSmtpDto } from './dto/update-smtp.dto';
import { UpdateOrderReceiptUrlDto } from './dto/update-order-receipt-url.dto';
export declare class SettingController {
    private readonly settingService;
    private readonly requestContext;
    constructor(settingService: SettingService, requestContext: RequestContextService);
    create(createSettingDto: CreateSettingDto): Promise<{
        status: string;
        message: string;
        data: import("./entities/setting.entity").Setting;
    }>;
    findAll(): Promise<{
        status: string;
        message: string;
        data: import("./entities/setting.entity").Setting[];
    }>;
    upsertSmtp(dto: UpdateSmtpDto): Promise<{
        status: string;
        message: string;
        data: import("./entities/setting.entity").Setting;
    }>;
    upsertOrderReceiptUrl(dto: UpdateOrderReceiptUrlDto): Promise<{
        status: string;
        message: string;
        data: import("./entities/setting.entity").Setting;
    }>;
    getOrderReceiptUrl(): Promise<{
        status: string;
        data: {
            orderReceiptUrl: string;
        };
    }>;
    findOne(id: string): Promise<{
        status: string;
        message: string;
        data: import("./entities/setting.entity").Setting;
    }>;
    update(id: string, updateSettingDto: UpdateSettingDto): Promise<{
        status: string;
        message: string;
        data: import("./entities/setting.entity").Setting;
    }>;
    remove(id: string): Promise<{
        status: string;
        message: string;
    }>;
}
