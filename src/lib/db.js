import 'dotenv/config';
import mysql from 'mysql2/promise';

let pool;

function getDbConfig() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASS;
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT || 3306);

  if (!user || !database) {
    throw new Error('Lipsesc variabile obligatorii pentru DB: DB_USER, DB_NAME.');
  }

  return {
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDbConfig());
  }

  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}
