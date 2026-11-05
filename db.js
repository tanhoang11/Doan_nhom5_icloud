
const mysql = require("mysql2/promise");
require("dotenv").config();

let pool;

function getPool() {
  if (!pool) {
    let config;

    // Xác định ứng dụng có đang chạy trên Railway hay không
    const isRailway = Boolean(
      process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_PROJECT_ID
    );

    const commonConfig = {
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
      timezone: "+07:00",
    };

    if (isRailway) {
      // Kết nối MySQL nội bộ khi ứng dụng chạy trên Railway
      config = {
        ...commonConfig,
        host: process.env.MYSQLHOST,
        port: Number(process.env.MYSQLPORT || 3306),
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD,
        database: process.env.MYSQLDATABASE,
      };

      console.log("Đang khởi tạo kết nối MySQL trên RAILWAY...");
    } else {
      // Kết nối MySQL Railway thông qua TCP Proxy khi chạy trên máy cá nhân
      if (!process.env.MYSQL_PUBLIC_URL) {
        throw new Error(
          "Chưa thiết lập MYSQL_PUBLIC_URL trong file .env"
        );
      }

      const url = new URL(process.env.MYSQL_PUBLIC_URL);

      config = {
        ...commonConfig,
        host: url.hostname,
        port: Number(url.port || 3306),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: decodeURIComponent(url.pathname.replace(/^\//, "")),
      };

      console.log("Đang khởi tạo kết nối MySQL ở LOCAL...");
    }

    // Kiểm tra các thông tin kết nối bắt buộc
    const requiredFields = ["host", "user", "database"];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Thiếu cấu hình MySQL: ${field}`);
      }
    }

    pool = mysql.createPool(config);

    console.log("Đã tạo pool kết nối MySQL:", {
      Máy_chủ: config.host,
      Cổng: config.port,
      Cơ_sở_dữ_liệu: config.database,
    });
  }

  return pool;
}

module.exports = { getPool };
