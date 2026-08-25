import { OnModuleInit } from '@nestjs/common';
import { SuperadminService } from './superadmin/superadmin.service';
export declare class AppService implements OnModuleInit {
    private readonly superadminService;
    constructor(superadminService: SuperadminService);
    onModuleInit(): Promise<void>;
    getHello(): string;
}
