import "dotenv/config";
import { getPool } from "../src/lib/db.js";

const SQL = `CREATE TABLE IF NOT EXISTS couple_submissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  couple_slug VARCHAR(120) NOT NULL,
  tip ENUM('story','recommendation','video') NOT NULL,
  continut TEXT NOT NULL,
  sursa VARCHAR(255) DEFAULT NULL,
  stare ENUM('in_asteptare','aprobat','respins') NOT NULL DEFAULT 'in_asteptare',
  creat_la TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_couple_submissions_slug (couple_slug)
) ENGINE=InnoDB`;

async function main() {
  const pool = getPool();
  await pool.execute(SQL);
  console.log("OK: tabela couple_submissions exista (creata sau deja prezenta).");
  await pool.end();
}

main().catch((error) => {
  console.error("Migrare esuata:", error);
  process.exit(1);
});
