import mysql from "mysql2/promise";

const globalForMysql = globalThis as typeof globalThis & { mysqlPool?: mysql.Pool };

export const pool = globalForMysql.mysqlPool ?? (
  process.env.DB_HOST
    ? mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 3306),
        user: process.env.DB_USER ?? "root",
        password: process.env.DB_PASSWORD ?? "",
        database: process.env.DB_NAME ?? "morrow_market",
        waitForConnections: true,
        connectionLimit: 8,
        queueLimit: 0,
        charset: "utf8mb4",
      })
    : null
);

if (pool && process.env.NODE_ENV !== "production") globalForMysql.mysqlPool = pool;
