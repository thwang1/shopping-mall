import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/db";
import type { User } from "@/lib/types";

export async function currentUser(): Promise<User | null> {
  if (!pool) return null;
  const token = (await cookies()).get("morrow_session")?.value;
  if (!token) return null;
  const [rows] = await pool.execute<(RowDataPacket & User)[]>(
    "SELECT u.id, u.username, u.name, u.email, u.phone, u.role, u.grade, u.points FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > NOW() LIMIT 1",
    [token],
  );
  return rows[0] ?? null;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "admin") return { user: null, response: Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }) };
  return { user, response: null };
}
