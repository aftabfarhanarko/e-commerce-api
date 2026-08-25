"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncOrdersSequence1775580000001 = void 0;
class SyncOrdersSequence1775580000001 {
    constructor() {
        this.name = 'SyncOrdersSequence1775580000001';
    }
    async up(queryRunner) {
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
    async down(queryRunner) {
    }
}
exports.SyncOrdersSequence1775580000001 = SyncOrdersSequence1775580000001;
//# sourceMappingURL=1775580000001-SyncOrdersSequence.js.map