import "dotenv/config";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import path from "node:path";

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    multipleStatements: true,
  });
  const schema = await readFile(path.join(process.cwd(), "schema.sql"), "utf8");
  await connection.query(schema);
  await connection.end();
  console.log("Database schema created.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
