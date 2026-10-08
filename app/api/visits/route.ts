import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  if (!pool) return Response.json({ ok: true, tracked: false });
  try {
    const cookieStore = await cookies();
    let visitor = cookieStore.get("morrow_visitor")?.value;
    if (!visitor) {
      visitor = randomBytes(20).toString("hex");
      cookieStore.set("morrow_visitor", visitor, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    await pool.execute("INSERT INTO visits (visitor_key) VALUES (?)", [visitor]);
    return Response.json({ ok: true, tracked: true });
  } catch {
    return Response.json({ error: "방문 기록을 저장하지 못했습니다." }, { status: 503 });
  }
}
