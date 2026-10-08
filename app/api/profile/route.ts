import type { ResultSetHeader } from "mysql2";
import { currentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  if (!pool) return Response.json({ error: "MySQL 연결이 설정되지 않았습니다." }, { status: 503 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json() as { name?: string; email?: string; phone?: string };
  const name = body.name?.trim() ?? "";
  if (!name || name.length > 80 || (body.email && body.email.length > 160) || (body.phone && body.phone.length > 30)) return Response.json({ error: "회원 정보를 확인해 주세요." }, { status: 400 });
  const [result] = await pool.execute<ResultSetHeader>("UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?", [name, body.email?.trim() ?? "", body.phone?.trim() ?? "", user.id]);
  return result.affectedRows ? Response.json({ user: { ...user, name, email: body.email?.trim() ?? "", phone: body.phone?.trim() ?? "" } }) : Response.json({ error: "회원 정보를 저장하지 못했습니다." }, { status: 500 });
}
