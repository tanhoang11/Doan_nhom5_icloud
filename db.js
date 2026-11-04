const mysql = require("mysql2/promise");
require("dotenv").config();

let pool;

function getPool() {
  if (!pool) {
    let config;

    if (process.env.NODE_ENV === "production") {
      config = {
        host: process.env.MYSQLHOST,
        port: Number(process.env.MYSQLPORT || 3306),
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD,
        database: process.env.MYSQLDATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true,
        timezone: "+07:00",
      };
      console.log("Đang khởi tạo kết nối MySQL cho môi trường PRODUCTION...");
    } else {
      if (!process.env.MYSQL_PUBLIC_URL) {
        throw new Error(
          "Chưa thiết lập biến MYSQL_PUBLIC_URL trong file .env (dành cho local)"
        );
      }
      const url = new URL(process.env.MYSQL_PUBLIC_URL);
      config = {
        host: url.hostname,
        port: Number(url.port),
        user: url.username,
        password: url.password,
        database: url.pathname.replace("/", ""),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true,
        timezone: "+07:00",
      };
      console.log("Đang khởi tạo kết nối MySQL cho môi trường LOCAL...");
    }

    pool = mysql.createPool(config);
    console.log("Đã tạo pool kết nối MySQL với cấu hình:");
    console.log({
      Máy_chủ: config.host,
      Cổng: config.port,
      Cơ_sở_dữ_liệu: config.database,
    });
  }
  return pool;
}

module.exports = { getPool };
