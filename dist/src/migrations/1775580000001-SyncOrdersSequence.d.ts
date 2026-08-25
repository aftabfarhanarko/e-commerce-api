import { MigrationInterface, QueryRunner } from "typeorm";
export declare class SyncOrdersSequence1775580000001 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
