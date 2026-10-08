import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

function authFailure(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  console.error("Authentication failed", error);
  const messages: Record<string, string> = {
    ER_NO_SUCH_TABLE: "인증 테이블이 없습니다. 프로젝트 폴더에서 npm run db:init을 실행해 주세요.",
    ER_BAD_DB_ERROR: ".env의 DB_NAME을 확인한 뒤 npm run db:init을 실행해 주세요.",
    ER_ACCESS_DENIED_ERROR: "MySQL 접속이 거부됐습니다. .env의 DB_USER와 DB_PASSWORD를 확인해 주세요.",
    ECONNREFUSED: "MySQL 서버에 연결할 수 없습니다. MySQL이 실행 중인지 확인해 주세요.",
    ETIMEDOUT: "MySQL 연결 시간이 초과됐습니다. DB_HOST와 DB_PORT를 확인해 주세요.",
  };
  const fallbackToDemo = code === "ECONNREFUSED" || code === "ETIMEDOUT";
  return Response.json({ error: messages[code] ?? "계정 요청을 처리하지 못했습니다. MySQL 설정과 서버 로그를 확인해 주세요.", fallbackToDemo }, { status: fallbackToDemo ? 503 : 500 });
}

export async function GET() {
  try {
    return Response.json({ user: await currentUser() });
  } catch {
    return Response.json({ error: "데이터베이스 연결을 확인해 주세요." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!pool) return Response.json({ error: "DB_HOST를 설정하면 계정이 서버에 저장됩니다." }, { status: 503 });
  try {
    const body = await request.json() as { action?: string; username?: string; password?: string; name?: string; email?: string };
    const cookieStore = await cookies();
    const token = cookieStore.get("morrow_session")?.value;
    if (body.action === "logout") {
      if (token) await pool.execute("DELETE FROM sessions WHERE token = ?", [token]);
      cookieStore.delete("morrow_session");
      return Response.json({ ok: true });
    }
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    if (body.action === "register") {
      const name = body.name?.trim() ?? "";
      if (!/^[a-zA-Z0-9_-]{3,40}$/.test(username) || password.length < 4 || !name) {
        return Response.json({ error: "아이디는 영문·숫자 3자 이상, 비밀번호는 4자 이상 입력해 주세요." }, { status: 400 });
      }
      const connection = await pool.getConnection();
      let userId: number;
      try {
        await connection.beginTransaction();
        const [existing] = await connection.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM users WHERE username = ? LIMIT 1", [username]);
        if (existing.length) {
          await connection.rollback();
          return Response.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const [result] = await connection.execute<ResultSetHeader>("INSERT INTO users (username, password_hash, name, email, points) VALUES (?, ?, ?, ?, 3000)", [username, passwordHash, name, body.email?.trim() ?? ""]);
        userId = result.insertId;
        const newToken = randomBytes(32).toString("hex");
        await connection.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))", [newToken, userId]);
        await connection.commit();
        cookieStore.set("morrow_session", newToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return Response.json({ user: { id: userId, username, name, email: body.email?.trim() ?? "", phone: "", role: "customer", grade: "welcome", points: 3000 } }, { status: 201 });
    }
    if (body.action !== "login" || !username || !password) return Response.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
    const [rows] = await pool.execute<(RowDataPacket & { id: number; username: string; password_hash: string; name: string; email: string; phone: string; role: "customer" | "admin"; grade: string; points: number })[]>("SELECT id, username, password_hash, name, email, phone, role, grade, points FROM users WHERE username = ? LIMIT 1", [username]);
    const found = rows[0];
    if (!found || !(await bcrypt.compare(password, found.password_hash))) return Response.json({ error: "아이디 또는 비밀번호를 확인해 주세요." }, { status: 401 });
    if (token) await pool.execute("DELETE FROM sessions WHERE token = ?", [token]);
    const newToken = randomBytes(32).toString("hex");
    await pool.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))", [newToken, found.id]);
    cookieStore.set("morrow_session", newToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
    const { password_hash: _passwordHash, ...user } = found;
    return Response.json({ user });
  } catch (error) {
    return authFailure(error);
  }
}
