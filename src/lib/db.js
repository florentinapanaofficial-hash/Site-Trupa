import 'dotenv/config';
import mysql from 'mysql2/promise';

let pool;

function getDbConfig() {
  const mysqlUrl = process.env.MYSQL_URL;

  if (!mysqlUrl) {
    throw new Error('Lipsește variabila obligatorie pentru DB: MYSQL_URL.');
  }

  return {
    uri: mysqlUrl,
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
