import "dotenv/config";
import mysql from "mysql2/promise";
import { seedProducts } from "../lib/seed-data";

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "morrow_market",
  });
  for (const product of seedProducts) {
    await connection.execute(
      "INSERT INTO products (id, name, category, price, description, image, colors, sizes, stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id",
      [product.id, product.name, product.category, product.price, product.description, product.image, JSON.stringify(product.colors), JSON.stringify(product.sizes), product.stock, product.featured ? 1 : 0],
    );
  }
  await connection.end();
  console.log(`${seedProducts.length} demo products are ready.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
