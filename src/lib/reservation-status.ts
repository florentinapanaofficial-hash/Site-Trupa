import { query } from './db.js';

type ColumnInfo = {
    Field: string;
};

let statusColumnPromise: Promise<void> | null = null;

export function ensureReservationStatusColumn(): Promise<void> {
    if (!statusColumnPromise) {
        statusColumnPromise = (async () => {
            const columns = await query(
                `SELECT COLUMN_NAME AS Field
                 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = ?
                   AND COLUMN_NAME = ?`,
                ['rezervari', 'status'],
            ) as ColumnInfo[];
            if (columns.length > 0) return;

            try {
                await query("ALTER TABLE rezervari ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'nou'");
            } catch (error) {
                if ((error as { code?: string })?.code !== 'ER_DUP_FIELDNAME') throw error;
            }
        })().catch((error) => {
            statusColumnPromise = null;
            throw error;
        });
    }

    return statusColumnPromise;
}