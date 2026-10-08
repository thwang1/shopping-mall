import type { ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { response } = await requireAdmin();
  if (response) return response;
  if (!pool) return Response.json({ error: "MySQL 연결이 설정되지 않았습니다." }, { status: 503 });
  const id = Number((await context.params).id);
  const product = await request.json() as Partial<Product>;
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "잘못된 상품 번호입니다." }, { status: 400 });
  try {
    const [result] = await pool.execute<ResultSetHeader>("UPDATE products SET name = COALESCE(?, name), category = COALESCE(?, category), price = COALESCE(?, price), description = COALESCE(?, description), image = COALESCE(?, image), colors = COALESCE(?, colors), sizes = COALESCE(?, sizes), stock = COALESCE(?, stock), featured = COALESCE(?, featured) WHERE id = ?", [product.name ?? null, product.category ?? null, product.price ?? null, product.description ?? null, product.image ?? null, product.colors ? JSON.stringify(product.colors) : null, product.sizes ? JSON.stringify(product.sizes) : null, product.stock ?? null, product.featured === undefined ? null : Number(product.featured), id]);
    if (!result.affectedRows) return Response.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "상품을 수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { response } = await requireAdmin();
  if (response) return response;
  if (!pool) return Response.json({ error: "MySQL 연결이 설정되지 않았습니다." }, { status: 503 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "잘못된 상품 번호입니다." }, { status: 400 });
  const [result] = await pool.execute<ResultSetHeader>("DELETE FROM products WHERE id = ?", [id]);
  return result.affectedRows ? Response.json({ ok: true }) : Response.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
}
