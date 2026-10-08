import type { ResultSetHeader } from "mysql2";
import { requireAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import type { OrderStatus } from "@/lib/types";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const statuses: OrderStatus[] = ["preparing", "shipping", "delivered"];

export async function PATCH(request: Request, context: Context) {
  const { response } = await requireAdmin();
  if (response) return response;
  if (!pool) return Response.json({ error: "MySQL 연결이 설정되지 않았습니다." }, { status: 503 });
  const id = Number((await context.params).id);
  const body = await request.json() as { status?: OrderStatus };
  if (!Number.isSafeInteger(id) || id < 1 || !body.status || !statuses.includes(body.status)) return Response.json({ error: "주문 번호 또는 배송 상태가 올바르지 않습니다." }, { status: 400 });
  const [result] = await pool.execute<ResultSetHeader>("UPDATE orders SET status = ? WHERE id = ?", [body.status, id]);
  return result.affectedRows ? Response.json({ ok: true }) : Response.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
}
