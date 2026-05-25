import { DataSource } from 'typeorm';
export declare class MigrationController {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    runMigrations(): Promise<{
        success: boolean;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message?: undefined;
    }>;
}
