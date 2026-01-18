// MySQL Database Service pro backend (server.js)
// Používá se pro autentizaci a databázové operace na serveru

const mysql = require('mysql2/promise');
require('dotenv').config();

// Databázové připojení z environment proměnných
const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.REACT_APP_MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || process.env.REACT_APP_MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || process.env.REACT_APP_MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.REACT_APP_MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || process.env.REACT_APP_MYSQL_DATABASE || 'alatyr_hosting',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Connection pool
let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// Helper pro získání připojení
async function getConnection() {
  const pool = getPool();
  return await pool.getConnection();
}

// Helper pro spuštění query
async function query(sql, params = []) {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Helper pro spuštění query s jedním výsledkem
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper pro INSERT/UPDATE/DELETE operace
async function execute(sql, params = []) {
  const pool = getPool();
  const [result] = await pool.execute(sql, params);
  return {
    affectedRows: result.affectedRows,
    insertId: result.insertId,
  };
}

// Helper pro transakce
async function transaction(callback) {
  const connection = await getConnection();
  await connection.beginTransaction();

  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Zavření pool při ukončení aplikace
process.on('SIGINT', async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
});

process.on('SIGTERM', async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
});

module.exports = {
  getPool,
  getConnection,
  query,
  queryOne,
  execute,
  transaction,
};
