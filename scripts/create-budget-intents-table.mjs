import 'dotenv/config';
import { getPool } from '../src/lib/db.js';

const pool = getPool();

try {
  await pool.execute(`CREATE TABLE IF NOT EXISTS budget_intents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    budget_eur SMALLINT UNSIGNED NOT NULL,
    page_path VARCHAR(128) NOT NULL,
    selected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_budget_intents_selected_at (selected_at)
  ) ENGINE=InnoDB`);
  console.log('OK: tabela budget_intents este pregatita.');
} finally {
  await pool.end();
}