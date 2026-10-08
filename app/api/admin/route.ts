import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import type { User } from "@/lib/types";

export const runtime = "nodejs";
const grades: User["grade"][] = ["welcome", "silver", "gold", "vip"];

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  if (!pool) return Response.json({ users: [], stats: { revenue: 0, orders: 0, members: 0, visitors: 0, daily: [], monthly: [] } });
  try {
    const [[sales]] = await pool.query<(RowDataPacket & { revenue: number; orders: number })[]>("SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders FROM orders");
    const [[members]] = await pool.query<(RowDataPacket & { members: number })[]>("SELECT COUNT(*) AS members FROM users WHERE role = 'customer'");
    const [[visitors]] = await pool.query<(RowDataPacket & { visitors: number })[]>("SELECT COUNT(DISTINCT visitor_key) AS visitors FROM visits WHERE visited_at >= CURRENT_DATE()");
    const [daily] = await pool.query<(RowDataPacket & { day: string; revenue: number; visitors: number })[]>("SELECT d.day, COALESCE(o.revenue, 0) AS revenue, COALESCE(v.visitors, 0) AS visitors FROM (SELECT DATE_SUB(CURRENT_DATE(), INTERVAL seq DAY) AS day FROM (SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11) days) d LEFT JOIN (SELECT DATE(created_at) AS day, SUM(total) AS revenue FROM orders WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 11 DAY) GROUP BY DATE(created_at)) o ON o.day = d.day LEFT JOIN (SELECT DATE(visited_at) AS day, COUNT(DISTINCT visitor_key) AS visitors FROM visits WHERE visited_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 11 DAY) GROUP BY DATE(visited_at)) v ON v.day = d.day ORDER BY d.day");
    const [monthly] = await pool.query<(RowDataPacket & { month: string; revenue: number; visitors: number })[]>("SELECT DATE_FORMAT(o.month, '%Y-%m') AS month, COALESCE(r.revenue, 0) AS revenue, COALESCE(v.visitors, 0) AS visitors FROM (SELECT DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL seq MONTH) AS month FROM (SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) months) o LEFT JOIN (SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS month, SUM(total) AS revenue FROM orders GROUP BY DATE_FORMAT(created_at, '%Y-%m-01')) r ON r.month = o.month LEFT JOIN (SELECT DATE_FORMAT(visited_at, '%Y-%m-01') AS month, COUNT(DISTINCT visitor_key) AS visitors FROM visits GROUP BY DATE_FORMAT(visited_at, '%Y-%m-01')) v ON v.month = o.month ORDER BY o.month DESC");
    const [users] = await pool.query<(RowDataPacket & Omit<User, "password">)[]>("SELECT id, username, name, email, phone, role, grade, points, created_at AS createdAt FROM users WHERE role = 'customer' ORDER BY created_at DESC");
    return Response.json({ users, stats: { revenue: sales.revenue, orders: sales.orders, members: members.members, visitors: visitors.visitors, daily, monthly } });
  } catch {
    return Response.json({ error: "관리자 통계를 불러오지 못했습니다." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  if (!pool) return Response.json({ error: "MySQL 연결이 설정되지 않았습니다." }, { status: 503 });
  const body = await request.json() as { userId?: number; grade?: User["grade"] };
  if (!Number.isSafeInteger(body.userId) || !body.userId || !body.grade || !grades.includes(body.grade)) return Response.json({ error: "회원 번호 또는 등급이 올바르지 않습니다." }, { status: 400 });
  const [result] = await pool.execute<ResultSetHeader>("UPDATE users SET grade = ? WHERE id = ? AND role = 'customer'", [body.grade, body.userId]);
  return result.affectedRows ? Response.json({ ok: true }) : Response.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
}
