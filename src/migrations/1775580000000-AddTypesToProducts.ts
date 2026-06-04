import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTypesToProducts1775580000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("tbl_products");
        if (table && !table.findColumnByName("types")) {
            await queryRunner.addColumn(
                "tbl_products",
                new TableColumn({
                    name: "types",
                    type: "text",
                    isNullable: true,
                }),
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("tbl_products");
        if (table && table.findColumnByName("types")) {
            await queryRunner.dropColumn("tbl_products", "types");
        }
    }
}
