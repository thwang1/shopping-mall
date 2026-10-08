import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "morrow_market",
  });
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "admin1234", 12);
  await connection.execute(
    "INSERT INTO users (username, password_hash, name, role, grade) VALUES (?, ?, ?, 'admin', 'vip') ON DUPLICATE KEY UPDATE role = 'admin'",
    ["admin", passwordHash, "관리자"],
  );
  await connection.end();
  console.log("Admin ready: admin / admin1234");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
