import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class EnsurePaidFieldsOnSystemUsers1775570000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
