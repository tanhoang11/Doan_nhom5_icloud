const { getPool } = require("./db");

async function testConnection() {
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT 1");
    console.log(" MySQL connected!", rows);
  } catch (err) {
    console.error("MySQL connection error:", err);
  }
}

testConnection();
