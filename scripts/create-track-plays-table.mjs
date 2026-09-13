import "dotenv/config";
import { getPool } from "../src/lib/db.js";

const SQL = `CREATE TABLE IF NOT EXISTS track_plays (
  track_id VARCHAR(191) NOT NULL,
  play_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (track_id)
) ENGINE=InnoDB`;

async function main() {
  const pool = getPool();
  await pool.execute(SQL);
  console.log("OK: tabela track_plays exista (creata sau deja prezenta).");
  await pool.end();
}

main().catch((error) => {
  console.error("Migrare esuata:", error);
  process.exit(1);
});
