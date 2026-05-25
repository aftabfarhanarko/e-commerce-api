import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddSubdomainEnabledToSystemUser1679999999999 implements MigrationInterface {
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
