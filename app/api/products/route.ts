import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { currentUser, requireAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { seedProducts } from "@/lib/seed-data";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!pool) return Response.json({ products: seedProducts, source: "demo" });
    const [rows] = await pool.query<(RowDataPacket & Product)[]>("SELECT id, name, category, price, description, image, colors, sizes, stock, featured FROM products ORDER BY featured DESC, id DESC");
    return Response.json({ products: rows.length ? rows : seedProducts, source: rows.length ? "mysql" : "demo" });
  } catch {
    return Response.json({ error: "상품 목록을 불러오지 못했습니다." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  if (!pool) return Response.json({ error: "MySQL 연결이 설정되지 않았습니다." }, { status: 503 });
  try {
    const product = await request.json() as Omit<Product, "id">;
    if (!product.name?.trim() || !Number.isFinite(product.price) || product.price < 0 || !Number.isInteger(product.stock) || product.stock < 0) return Response.json({ error: "상품명, 가격, 재고를 확인해 주세요." }, { status: 400 });
    const [result] = await pool.execute<ResultSetHeader>("INSERT INTO products (name, category, price, description, image, colors, sizes, stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [product.name.trim(), product.category, product.price, product.description ?? "", product.image ?? "", JSON.stringify(product.colors ?? []), JSON.stringify(product.sizes ?? []), product.stock, product.featured ? 1 : 0]);
    return Response.json({ product: { ...product, id: result.insertId } }, { status: 201 });
  } catch {
    return Response.json({ error: "상품을 저장하지 못했습니다." }, { status: 500 });
  }
}
