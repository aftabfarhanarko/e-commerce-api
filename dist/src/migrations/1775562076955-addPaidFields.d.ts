import { MigrationInterface, QueryRunner } from "typeorm";
export declare class AddPaidFields1775562076955 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
