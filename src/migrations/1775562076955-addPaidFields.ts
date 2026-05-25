import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaidFields1775562076955 implements MigrationInterface {
    name = 'AddPaidFields1775562076955'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const originalQuery = queryRunner.query.bind(queryRunner);
        queryRunner.query = async (query: string, parameters?: any[], queryRunnerObject?: any) => {
            try {
                return await originalQuery(query, parameters, queryRunnerObject);
            } catch (e) {
                console.warn(`[Migration Warning] AddPaidFields1775562076955 up query failed, continuing: ${query}. Error: ${e.message}`);
            }
        };

        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_9bb53cb4c941553750b89f350e0"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_1457f286d91f271313fded23e53"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "UQ_41ba27842ac1a2c24817ca59eaa"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "orderId"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "clientId"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "categoryId"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "service"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "amount"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "progress"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "assignedTo"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "date"`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerName" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerPhone" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerEmail" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerAddress" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "items" json`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "totalAmount" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "paymentReference" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "orderInfo" json`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "paymentMethod" character varying NOT NULL DEFAULT 'DIRECT'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "shippingTrackingId" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "shippingProvider" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "isPaid" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "companyId" character varying NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "deliveryType" character varying NOT NULL DEFAULT 'INSIDEDHAKA'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "deliveryNote" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "cancelNote" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "deletedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerId" integer`);
        await queryRunner.query(`ALTER TABLE "tbl_products" ADD "types" text`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "paidAmount" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "status" character varying NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TYPE "public"."tbl_products_status_enum" RENAME TO "tbl_products_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_products_status_enum" AS ENUM('draft', 'published', 'trashed', 'pending')`);
        await queryRunner.query(`ALTER TABLE "tbl_products" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "tbl_products" ALTER COLUMN "status" TYPE "public"."tbl_products_status_enum" USING "status"::"text"::"public"."tbl_products_status_enum"`);
        await queryRunner.query(`ALTER TABLE "tbl_products" ALTER COLUMN "status" SET DEFAULT 'published'`);
        await queryRunner.query(`DROP TYPE "public"."tbl_products_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_e5de51ca888d8b1f5ac25799dd1" FOREIGN KEY ("customerId") REFERENCES "tbl_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "system_users" ADD IF NOT EXISTS "paidTotalSoldQty" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "system_users" ADD IF NOT EXISTS "paidTotalEarning" numeric(12,2) NOT NULL DEFAULT '0'`);

        queryRunner.query = originalQuery;
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const originalQuery = queryRunner.query.bind(queryRunner);
        queryRunner.query = async (query: string, parameters?: any[], queryRunnerObject?: any) => {
            try {
                return await originalQuery(query, parameters, queryRunnerObject);
            } catch (e) {
                console.warn(`[Migration Warning] AddPaidFields1775562076955 down query failed, continuing: ${query}. Error: ${e.message}`);
            }
        };

        await queryRunner.query(`ALTER TABLE "system_users" DROP COLUMN IF EXISTS "paidTotalEarning"`);
        await queryRunner.query(`ALTER TABLE "system_users" DROP COLUMN IF EXISTS "paidTotalSoldQty"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_e5de51ca888d8b1f5ac25799dd1"`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_products_status_enum_old" AS ENUM('draft', 'published', 'trashed')`);
        await queryRunner.query(`ALTER TABLE "tbl_products" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "tbl_products" ALTER COLUMN "status" TYPE "public"."tbl_products_status_enum_old" USING "status"::"text"::"public"."tbl_products_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "tbl_products" ALTER COLUMN "status" SET DEFAULT 'published'`);
        await queryRunner.query(`DROP TYPE "public"."tbl_products_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."tbl_products_status_enum_old" RENAME TO "tbl_products_status_enum"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('Pending', 'In Progress', 'Review', 'Completed')`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "status" "public"."orders_status_enum" NOT NULL DEFAULT 'Pending'`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "paidAmount" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "tbl_products" DROP COLUMN "types"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerId"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deletedAt"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "cancelNote"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deliveryNote"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deliveryType"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "companyId"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "isPaid"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "shippingProvider"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "shippingTrackingId"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentMethod"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "orderInfo"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentReference"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "totalAmount"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "items"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerAddress"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerEmail"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerPhone"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerName"`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "date" date`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "assignedTo" text`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "progress" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "amount" numeric(10,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "service" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "categoryId" integer`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "clientId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "orderId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "UQ_41ba27842ac1a2c24817ca59eaa" UNIQUE ("orderId")`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_1457f286d91f271313fded23e53" FOREIGN KEY ("clientId") REFERENCES "our_client"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_9bb53cb4c941553750b89f350e0" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        queryRunner.query = originalQuery;
    }

}

// gggdfgdg