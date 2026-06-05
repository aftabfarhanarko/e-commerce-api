import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncOrdersSequence1775580000001 implements MigrationInterface {
    name = 'SyncOrdersSequence1775580000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
                seq_name text;
                max_id integer;
            BEGIN
                SELECT pg_get_serial_sequence('orders', 'id') INTO seq_name;
                IF seq_name IS NOT NULL THEN
                    SELECT MAX(id) INTO max_id FROM orders;
                    IF max_id IS NULL THEN max_id := 0; END IF;
                    PERFORM setval(seq_name, max_id + 1, false);
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No down migration needed
    }
}
