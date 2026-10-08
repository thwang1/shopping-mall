import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { currentUser, requireAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
type CheckoutBody = { items: { productId: number; quantity: number; color?: string; size?: string }[]; recipient: string; address: string; paymentMethod: "card" | "easy" };

export async function GET() {
  try {
    if (!pool) return Response.json({ orders: [] });
    const user = await currentUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const admin = user.role === "admin";
    const [orders] = await pool.execute<(RowDataPacket & { id: number; user_id: number; total: number; status: string; recipient: string; address: string; payment_method: string; created_at: Date })[]>(`SELECT id, user_id, total, status, recipient, address, payment_method, created_at FROM orders ${admin ? "" : "WHERE user_id = ?"} ORDER BY created_at DESC`, admin ? [] : [user.id]);
    if (!orders.length) return Response.json({ orders: [] });
    const orderIds = orders.map((order) => order.id);
    const placeholders = orderIds.map(() => "?").join(",");
    const [items] = await pool.execute<(RowDataPacket & { order_id: number; product_id: number; product_name: string; image: string; unit_price: number; quantity: number; color: string; size: string })[]>(`SELECT order_id, product_id, product_name, image, unit_price, quantity, color, size FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
    return Response.json({ orders: orders.map((order) => ({ id: String(order.id), userId: order.user_id, total: order.total, status: order.status, recipient: order.recipient, address: order.address, paymentMethod: order.payment_method, createdAt: order.created_at, items: items.filter((item) => item.order_id === order.id).map((item) => ({ productId: item.product_id, name: item.product_name, image: item.image, price: item.unit_price, quantity: item.quantity, color: item.color, size: item.size })) })) });
  } catch {
    return Response.json({ error: "주문 내역을 불러오지 못했습니다." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!pool) return Response.json({ error: "MySQL 연결이 설정되지 않았습니다." }, { status: 503 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: CheckoutBody;
  try { body = await request.json() as CheckoutBody; } catch { return Response.json({ error: "주문 정보가 올바르지 않습니다." }, { status: 400 }); }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50 || !body.recipient?.trim() || !body.address?.trim() || !["card", "easy"].includes(body.paymentMethod)) return Response.json({ error: "배송 정보와 상품을 확인해 주세요." }, { status: 400 });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let subtotal = 0;
    const lines: { id: number; name: string; image: string; price: number; quantity: number; color: string; size: string }[] = [];
    for (const item of body.items) {
      if (!Number.isSafeInteger(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error("BAD_ITEM");
      const [rows] = await connection.execute<(RowDataPacket & { id: number; name: string; image: string; price: number; stock: number })[]>("SELECT id, name, image, price, stock FROM products WHERE id = ? FOR UPDATE", [item.productId]);
      const product = rows[0];
      if (!product || product.stock < item.quantity) throw new Error("OUT_OF_STOCK");
      subtotal += product.price * item.quantity;
      lines.push({ id: product.id, name: product.name, image: product.image, price: product.price, quantity: item.quantity, color: item.color ?? "", size: item.size ?? "" });
    }
    const total = subtotal + (subtotal >= 50000 ? 0 : 3000);
    const [result] = await connection.execute<ResultSetHeader>("INSERT INTO orders (user_id, total, payment_method, recipient, address) VALUES (?, ?, ?, ?, ?)", [user.id, total, body.paymentMethod, body.recipient.trim(), body.address.trim()]);
    for (const line of lines) {
      await connection.execute("INSERT INTO order_items (order_id, product_id, product_name, image, unit_price, quantity, color, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [result.insertId, line.id, line.name, line.image, line.price, line.quantity, line.color, line.size]);
      await connection.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [line.quantity, line.id]);
    }
    const earned = Math.floor(subtotal * 0.01);
    await connection.execute("UPDATE users SET points = points + ? WHERE id = ?", [earned, user.id]);
    await connection.commit();
    return Response.json({ order: { id: String(result.insertId), userId: user.id, total, status: "preparing", createdAt: new Date().toISOString(), recipient: body.recipient.trim(), address: body.address.trim(), paymentMethod: body.paymentMethod, items: lines.map((line) => ({ productId: line.id, name: line.name, image: line.image, price: line.price, quantity: line.quantity, color: line.color, size: line.size })) } }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error && error.message === "OUT_OF_STOCK" ? "재고가 부족한 상품이 있습니다." : error instanceof Error && error.message === "BAD_ITEM" ? "상품 수량이 올바르지 않습니다." : "주문을 처리하지 못했습니다.";
    const status = error instanceof Error && error.message === "OUT_OF_STOCK" ? 409 : error instanceof Error && error.message === "BAD_ITEM" ? 400 : 500;
    return Response.json({ error: message }, { status });
  } finally {
    connection.release();
  }
}
