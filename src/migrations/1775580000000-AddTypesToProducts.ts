import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTypesToProducts1775580000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tbl_products" ADD COLUMN IF NOT EXISTS "types" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tbl_products" DROP COLUMN IF EXISTS "types"`);
    }
}
