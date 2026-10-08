"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, ShoppingBag as BagIcon, Check, ChevronDown, ChevronRight,
  CircleUserRound, CreditCard, Heart, LayoutDashboard, LogOut, Menu, Minus, Package,
  Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Truck, X,
} from "lucide-react";
import { seedProducts } from "@/lib/seed-data";
import type { CartItem, Category, Order, OrderStatus, Product, User } from "@/lib/types";

type LocalUser = User & { password: string };
type AdminStats = { revenue: number; orders: number; members: number; visitors: number; daily: { day: string; revenue: number; visitors: number }[]; monthly: { month: string; revenue: number; visitors: number }[] };
type View = "shop" | "account" | "admin";
type Modal = "login" | "register" | "product" | "product-form" | null;
const categories: Category[] = ["전체", "의류", "리빙", "액세서리", "뷰티"];
const initialAdmin: LocalUser = { id: 1, username: "admin", password: "admin1234", name: "관리자", email: "admin@morrow.kr", phone: "010-0000-0000", role: "admin", grade: "vip", points: 0 };
const money = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
const statusLabel: Record<OrderStatus, string> = { preparing: "배송 준비", shipping: "배송 중", delivered: "배송 완료" };
const readStore = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
};

export default function Home() {
  const [view, setView] = useState<View>("shop");
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("전체");
  const [sort, setSort] = useState("추천순");
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<LocalUser[]>([initialAdmin]);
  const [user, setUser] = useState<User | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "easy">("card");
  const [recipient, setRecipient] = useState("");
  const [address, setAddress] = useState("");
  const [notice, setNotice] = useState("");
  const [adminTab, setAdminTab] = useState("overview");
  const [productDraft, setProductDraft] = useState<Partial<Product>>({ category: "의류", colors: ["오프화이트"], sizes: ["FREE"], stock: 10 });
  const [profileDraft, setProfileDraft] = useState({ name: "", email: "", phone: "" });
  const [serverBacked, setServerBacked] = useState(false);
  const [serverStats, setServerStats] = useState<AdminStats | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedProducts = localStorage.getItem("morrow-products");
    if (savedProducts) setProducts(readStore("morrow-products", seedProducts));
    setCart(readStore("morrow-cart", []));
    setOrders(readStore("morrow-orders", []));
    setUsers(readStore("morrow-users", [initialAdmin]));
    setUser(readStore("morrow-user", null));
    setReady(true);
    void fetch("/api/products").then(async (response) => {
      if (!response.ok || savedProducts) return;
      const data = await response.json() as { products: Product[] };
      if (data.products?.length) setProducts(data.products);
    }).catch(() => undefined);
    void fetch("/api/auth").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { user: User | null };
      if (data.user) {
        setUser(data.user); setServerBacked(true);
        if (data.user.role === "admin") {
          const adminResponse = await fetch("/api/admin");
          if (adminResponse.ok) {
            const adminData = await adminResponse.json() as { users: LocalUser[] };
            setServerStats((adminData as { stats?: AdminStats }).stats ?? null);
            setUsers((current) => [...adminData.users.map((entry) => ({ ...entry, password: "" })), ...current.filter((entry) => entry.role === "admin")]);
          }
        }
      }
    }).catch(() => undefined);
    void fetch("/api/visits", { method: "POST" }).catch(() => undefined);
    void fetch("/api/orders").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { orders: Order[] };
      if (data.orders?.length) setOrders((current) => [...data.orders, ...current.filter((order) => !data.orders.some((saved) => saved.id === order.id))]);
    }).catch(() => undefined);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("morrow-products", JSON.stringify(products)); }, [products, ready]);
  useEffect(() => { if (ready) localStorage.setItem("morrow-cart", JSON.stringify(cart)); }, [cart, ready]);
  useEffect(() => { if (ready) localStorage.setItem("morrow-orders", JSON.stringify(orders)); }, [orders, ready]);
  useEffect(() => { if (ready) localStorage.setItem("morrow-users", JSON.stringify(users)); }, [users, ready]);
  useEffect(() => { if (ready) localStorage.setItem("morrow-user", JSON.stringify(user)); }, [user, ready]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredProducts = useMemo(() => {
    const matched = products.filter((product) => (category === "전체" || product.category === category)
      && `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(search.toLowerCase()));
    return [...matched].sort((a, b) => sort === "낮은 가격순" ? a.price - b.price : sort === "높은 가격순" ? b.price - a.price : Number(b.featured) - Number(a.featured));
  }, [products, category, search, sort]);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isAdmin = user?.username === "admin" && user.role === "admin";
  const myOrders = orders.filter((order) => order.userId === user?.id || (!order.userId && order.id.startsWith(`${user?.id ?? "guest"}-`)));

  function showView(nextView: View) {
    if (nextView === "admin" && !isAdmin) { setNotice("관리자 계정으로 로그인해 주세요."); setModal("login"); return; }
    if (nextView === "account" && !user) { setNotice("로그인 후 이용할 수 있어요."); setModal("login"); return; }
    setView(nextView);
  }
  function signOut() {
    if (serverBacked) void fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setServerBacked(false);
    setUser(null); setView("shop"); setNotice("로그아웃 되었습니다.");
  }
  async function handleAuth(event: FormEvent<HTMLFormElement>, mode: "login" | "register") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    let usingDemoFallback = false;
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, username, password, name: String(form.get("name") ?? "").trim(), email: String(form.get("email") ?? "").trim() }) });
      const data = await response.json() as { user?: User; error?: string; fallbackToDemo?: boolean };
      if (response.ok && data.user) {
        const authenticated = { ...data.user, password } as LocalUser;
        setServerBacked(true); setUser(data.user); setUsers((current) => [...current.filter((entry) => entry.username !== username), authenticated]);
        if (data.user.role === "admin") void refreshAdminData();
        setProfileDraft({ name: data.user.name, email: data.user.email, phone: data.user.phone }); setModal(null); setNotice(`${data.user.name}님, 반가워요.`); return;
      }
      if (data.fallbackToDemo) usingDemoFallback = true;
      else if (data.error === "DB_HOST를 설정하면 계정이 서버에 저장됩니다.") usingDemoFallback = true;
      else { setNotice(data.error ?? "로그인 요청을 처리하지 못했습니다."); return; }
    } catch { usingDemoFallback = true; }
    if (mode === "register") {
      const name = String(form.get("name") ?? "").trim();
      if (users.some((entry) => entry.username === username)) { setNotice("이미 사용 중인 아이디예요."); return; }
      const newUser: LocalUser = { id: Date.now(), username, password, name, email: String(form.get("email") ?? ""), phone: "", role: "customer", grade: "welcome", points: 3000 };
      setUsers((current) => [...current, newUser]); setUser(newUser); setNotice(usingDemoFallback ? "MySQL 연결이 없어 브라우저에만 계정을 저장했습니다. 3,000 포인트를 드렸어요." : "가입을 환영해요. 3,000 포인트를 드렸어요.");
    } else {
      const found = users.find((entry) => entry.username === username && entry.password === password);
      if (!found) { setNotice("아이디 또는 비밀번호를 확인해 주세요."); return; }
      setUser(found); setNotice(usingDemoFallback ? "MySQL 연결이 없어 브라우저 데모 계정으로 로그인했습니다." : `${found.name}님, 반가워요.`);
    }
    setProfileDraft({ name: username === "admin" ? "관리자" : String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), phone: "" });
    setModal(null);
  }
  function openProduct(product: Product) {
    setSelectedProduct(product); setSelectedColor(product.colors[0] ?? ""); setSelectedSize(product.sizes[0] ?? ""); setQuantity(1); setModal("product");
  }
  function addToCart(product = selectedProduct) {
    if (!product || product.stock < 1) return;
    const color = selectedColor || product.colors[0] || "기본";
    const size = selectedSize || product.sizes[0] || "FREE";
    setCart((current) => {
      const found = current.find((item) => item.productId === product.id && item.color === color && item.size === size);
      return found ? current.map((item) => item === found ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) } : item)
        : [...current, { productId: product.id, name: product.name, image: product.image, price: product.price, color, size, quantity: Math.min(quantity, product.stock) }];
    });
    setModal(null); setCartOpen(true); setNotice("장바구니에 담았어요.");
  }
  function changeCart(index: number, delta: number) {
    setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(1, Math.min(item.quantity + delta, products.find((product) => product.id === item.productId)?.stock ?? 99)) } : item));
  }
  function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length) return;
    if (serverBacked) {
      void fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, color: item.color, size: item.size })), recipient, address, paymentMethod }) })
        .then(async (response) => {
          const data = await response.json() as { order?: Order; error?: string };
          if (!response.ok || !data.order) { setNotice(data.error ?? "주문을 처리하지 못했습니다."); return; }
          setOrders((current) => [data.order!, ...current]); setProducts((current) => current.map((product) => {
            const sold = cart.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
            return sold ? { ...product, stock: Math.max(0, product.stock - sold) } : product;
          }));
          const earned = Math.floor(data.order.total * 0.01);
          setUser((current) => current ? { ...current, points: current.points + earned } : current);
          void refreshAdminData();
          setCart([]); setCheckoutOpen(false); setCartOpen(false); setView("account"); setNotice(`주문이 완료됐어요. 테스트 결제 ${money(data.order.total)} 승인 (실제 청구 없음)`);
        }).catch(() => setNotice("서버와 연결할 수 없어 주문을 보류했어요."));
      return;
    }
    const order: Order = { id: `${user?.id ?? "guest"}-${Date.now()}`, userId: user?.id, total: cartTotal + (cartTotal >= 50000 ? 0 : 3000), status: "preparing", createdAt: new Date().toISOString(), recipient: recipient.trim(), address: address.trim(), paymentMethod, items: cart };
    setOrders((current) => [order, ...current]);
    setProducts((current) => current.map((product) => {
      const sold = cart.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
      return sold ? { ...product, stock: Math.max(0, product.stock - sold) } : product;
    }));
    if (user) {
      const earned = Math.floor(cartTotal * 0.01);
      setUser((current) => current ? { ...current, points: current.points + earned } : current);
      setUsers((current) => current.map((entry) => entry.id === user.id ? { ...entry, points: entry.points + Math.floor(cartTotal * 0.01) } : entry));
    }
    setCart([]); setCheckoutOpen(false); setCartOpen(false); setView(user ? "account" : "shop");
    setNotice(`주문이 완료됐어요. 테스트 결제 ${money(order.total)} 승인 (실제 청구 없음)`);
  }
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const product: Product = {
      id: productDraft.id ?? Date.now(), name: String(form.get("name")), category: String(form.get("category")) as Product["category"],
      price: Number(form.get("price")), description: String(form.get("description")), image: String(form.get("image")) || seedProducts[0].image,
      colors: String(form.get("colors")).split(",").map((value) => value.trim()).filter(Boolean),
      sizes: String(form.get("sizes")).split(",").map((value) => value.trim()).filter(Boolean), stock: Number(form.get("stock")), featured: Boolean(form.get("featured")),
    };
    if (serverBacked) {
      const response = await fetch(productDraft.id ? `/api/products/${productDraft.id}` : "/api/products", { method: productDraft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(product) });
      if (!response.ok) { setNotice("상품을 저장하지 못했습니다."); return; }
      if (!productDraft.id) {
        const data = await response.json() as { product: Product };
        product.id = data.product.id;
      }
    }
    setProducts((current) => productDraft.id ? current.map((entry) => entry.id === product.id ? product : entry) : [product, ...current]);
    setModal(null); setProductDraft({ category: "의류", colors: ["오프화이트"], sizes: ["FREE"], stock: 10 }); setNotice("상품 정보를 저장했어요.");
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    if (serverBacked) {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileDraft) });
      if (!response.ok) { setNotice("회원 정보를 저장하지 못했습니다."); return; }
    }
    const updated = { ...user, ...profileDraft };
    setUser(updated); setUsers((current) => current.map((entry) => entry.id === user.id ? { ...entry, ...profileDraft } : entry)); setNotice("회원 정보가 수정됐어요.");
  }
  async function updateOrder(orderId: string, status: OrderStatus) {
    if (serverBacked) {
      const response = await fetch(`/api/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) { setNotice("배송 상태를 변경하지 못했습니다."); return; }
    }
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
    setNotice("배송 상태를 변경했어요.");
  }
  async function updateGrade(userId: number, grade: User["grade"]) {
    if (serverBacked) {
      const response = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, grade }) });
      if (!response.ok) { setNotice("회원 등급을 변경하지 못했습니다."); return; }
      void refreshAdminData();
    }
    setUsers((current) => current.map((entry) => entry.id === userId ? { ...entry, grade } : entry)); setNotice("회원 등급을 변경했어요.");
  }
  async function changeStock(productId: number, change: number) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) return;
    const stock = Math.max(0, product.stock + change);
    if (serverBacked) {
      const response = await fetch(`/api/products/${productId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stock }) });
      if (!response.ok) { setNotice("재고를 변경하지 못했습니다."); return; }
    }
    setProducts((current) => current.map((entry) => entry.id === productId ? { ...entry, stock } : entry));
  }
  async function deleteProduct(productId: number) {
    if (!window.confirm("이 상품을 삭제할까요?")) return;
    if (serverBacked) {
      const response = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      if (!response.ok) { setNotice("상품을 삭제하지 못했습니다."); return; }
    }
    setProducts((current) => current.filter((item) => item.id !== productId));
  }
  function startEdit(product: Product) {
    setProductDraft(product); setModal("product-form");
  }
  const totalRevenue = serverStats?.revenue ?? orders.reduce((sum, order) => sum + order.total, 0);
  const orderCount = serverStats?.orders ?? orders.length;
  const memberCount = serverStats?.members ?? users.filter((entry) => entry.role !== "admin").length;
  const localDailyData = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (11 - index));
    const dayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === date.toDateString());
    return { day: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, revenue: dayOrders.reduce((sum, order) => sum + order.total, 0), visitors: 22 + (index * 7 % 17) };
  });
  const dailyData = serverStats?.daily.length ? serverStats.daily : localDailyData;
  const visitorCount = serverStats?.visitors ?? dailyData.at(-1)?.visitors ?? 38;
  const todayRevenue = dailyData.at(-1)?.revenue ?? 0;
  const monthlyData = serverStats?.monthly.length
    ? serverStats.monthly.slice(0, 4)
    : Array.from({ length: 4 }, (_, index) => {
        const date = new Date(); date.setMonth(date.getMonth() - index);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return { month, revenue: orders.filter((order) => order.createdAt.slice(0, 7) === month).reduce((sum, order) => sum + order.total, 0), visitors: index === 0 ? visitorCount : Math.max(0, 120 - index * 24) };
      });
  const maxDailyRevenue = Math.max(...dailyData.map((entry) => entry.revenue), 1);
  const maxDailyVisitors = Math.max(...dailyData.map((entry) => entry.visitors), 1);
  const chartValues = dailyData.map((entry) => Math.max(5, Math.round(entry.revenue / maxDailyRevenue * 70 + entry.visitors / maxDailyVisitors * 20)));

  async function refreshAdminData() {
    const response = await fetch("/api/admin");
    if (!response.ok) return;
    const data = await response.json() as { users: LocalUser[]; stats: AdminStats };
    setServerStats(data.stats);
    setUsers((current) => [...data.users.map((entry) => ({ ...entry, password: "" })), ...current.filter((entry) => entry.role === "admin")]);
  }

  return (
    <main>
      <div className="announcement"><Sparkles size={13} /> 첫 구매 고객에게 3,000 포인트를 드려요 <span>·</span> 5만원 이상 무료배송</div>
      <header className="site-header">
        <button className="wordmark" onClick={() => showView("shop")} aria-label="Morrow Market 홈">morrow<span>·</span></button>
        <nav className="main-nav" aria-label="주요 메뉴">
          <button className={view === "shop" ? "active" : ""} onClick={() => showView("shop")}>SHOP</button>
          <button onClick={() => { setCategory("리빙"); showView("shop"); }}>LIVING</button>
          <button onClick={() => { setCategory("액세서리"); showView("shop"); }}>OBJECTS</button>
          {isAdmin && <button className={view === "admin" ? "active admin-link" : "admin-link"} onClick={() => showView("admin")}><LayoutDashboard size={14} /> ADMIN</button>}
        </nav>
        <div className="header-actions">
          <label className="header-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setView("shop"); }} placeholder="찾으시는 상품이 있나요?" /><kbd>⌘ K</kbd></label>
          <button className="icon-button account-button" aria-label={user ? "마이페이지" : "로그인"} onClick={() => user ? showView("account") : setModal("login")}>
            <CircleUserRound size={19} />{user && <span className="user-name">{user.name}</span>}
          </button>
          <button className="icon-button bag-button" aria-label="장바구니 열기" onClick={() => setCartOpen(true)}><BagIcon size={19} /><span className="bag-count">{cartCount}</span></button>
          <button className="mobile-menu" aria-label="메뉴" onClick={() => showView("shop")}><Menu size={20} /></button>
        </div>
      </header>

      {view === "shop" && <>
        <section className="hero">
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot" /> OBJECTS FOR SLOWER DAYS</p><h1>조금 더 천천히,<br /><em>나답게</em> 살아가는 일.</h1><p className="hero-description">매일의 순간을 편안하게 채우는<br className="desktop-break" /> 작은 취향을 발견해 보세요.</p><button className="button dark-button" onClick={() => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })}>컬렉션 둘러보기 <ArrowRight size={16} /></button><div className="hero-note"><span>01 / 04</span><div /><span>NEW SEASON, NEW RHYTHM</span></div></div>
          <div className="hero-image" role="img" aria-label="햇살이 드는 편안한 공간"><div className="hero-image-caption"><span>THE EVERYDAY EDIT</span><span>SPRING / SUMMER 2026</span></div></div>
          <div className="hero-stamp">MADE FOR<br />YOUR SLOW<br /><span>mornings</span></div>
        </section>
        <section className="intro-strip"><span>01 — CURATED OBJECTS</span><p>좋은 물건은 일상을 조금 다르게 만듭니다.</p><span>서울에서 천천히 고릅니다 <ArrowDownRight size={14} /></span></section>
        <section className="collection section-wrap" id="collection">
          <div className="section-heading"><div><p className="eyebrow">THE MORROW COLLECTION</p><h2>오늘을 위한 작은 발견</h2></div><span className="result-count">{filteredProducts.length.toString().padStart(2, "0")} OBJECTS</span></div>
          <div className="shop-controls"><div className="category-tabs" role="tablist" aria-label="상품 카테고리">{categories.map((item) => <button key={item} role="tab" aria-selected={category === item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="sort-select"><SlidersHorizontal size={14} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="상품 정렬"><option>추천순</option><option>낮은 가격순</option><option>높은 가격순</option></select><ChevronDown size={13} /></label></div>
          {filteredProducts.length ? <div className="product-grid">{filteredProducts.map((product, index) => <article className="product-card" key={product.id}>
            <button className="product-image-button" onClick={() => openProduct(product)} aria-label={`${product.name} 상세 보기`}><div className="product-image" style={{ backgroundImage: `url("${product.image}")` }} />
              {product.stock === 0 ? <span className="product-badge sold">SOLD OUT</span> : product.featured && <span className="product-badge">CURATED</span>}
              <span className="quick-add"><Plus size={17} /></span>
            </button><div className="product-meta"><div><span className="product-category">{product.category}</span><h3>{product.name}</h3></div><button className="heart-button" aria-label="관심 상품" onClick={() => setNotice("관심 상품은 로그인 후 저장할 수 있어요.")}><Heart size={16} /></button></div>
            <div className="product-price">{money(product.price)}<span>{product.stock === 0 ? "일시 품절" : `재고 ${product.stock}개`}</span></div>
          </article>)}</div> : <div className="empty-state"><Search size={24} /><p>검색 결과가 없어요.</p><button onClick={() => { setSearch(""); setCategory("전체"); }}>전체 상품 보기</button></div>}
        </section>
        <section className="editorial"><div className="editorial-image" /><div className="editorial-copy"><p className="eyebrow">A NOTE FROM MORROW</p><h2>물건을 고르는 일도<br /><em>나를 돌보는 시간</em>이니까.</h2><p>오래 곁에 두고 싶은 것들, 쓸수록 좋아지는 것들. 모로우가 천천히 고르고 다정하게 소개합니다.</p><button className="text-link" onClick={() => setCategory("리빙")}>모로우의 기준 <ArrowRight size={15} /></button></div></section>
        <Newsletter />
      </>}

      {view === "account" && user && <section className="account-page section-wrap"><div className="account-heading"><div><p className="eyebrow">MY MORROW</p><h1>반가워요, {user.name}님</h1><p>오늘도 모로우와 함께해 주셔서 고마워요.</p></div><button className="subtle-button" onClick={signOut}><LogOut size={15} /> 로그아웃</button></div><div className="member-summary"><div><span>MEMBER GRADE</span><strong>{user.grade.toUpperCase()} MEMBER</strong></div><div><span>사용 가능 포인트</span><strong>{user.points.toLocaleString()} <small>P</small></strong></div><div><span>누적 주문</span><strong>{myOrders.length} <small>건</small></strong></div><div className="summary-ornament">M<span>·</span></div></div>
        <div className="account-columns"><section className="account-section"><div className="account-section-title"><h2>주문 내역</h2><span>{myOrders.length} ORDERS</span></div>{myOrders.length ? <div className="order-list">{myOrders.map((order) => <article className="order-row" key={order.id}><div className="order-date">{new Date(order.createdAt).toLocaleDateString("ko-KR")}<span>주문번호 {order.id.slice(-8)}</span></div><div className="order-product-preview">{order.items.slice(0, 3).map((item) => <div key={`${item.productId}-${item.color}-${item.size}`} style={{ backgroundImage: `url("${item.image}")` }} />)}<span>{order.items[0]?.name}{order.items.length > 1 && ` 외 ${order.items.length - 1}건`}</span></div><span className={`status-pill ${order.status}`}>{statusLabel[order.status]}</span><strong>{money(order.total)}</strong><Truck size={17} className="order-truck" /></article>)}</div> : <div className="account-empty"><Package size={22} /><p>아직 주문 내역이 없어요.</p><button onClick={() => showView("shop")}>상품 둘러보기 <ArrowRight size={14} /></button></div>}</section>
          <section className="account-section profile-section"><div className="account-section-title"><h2>회원 정보</h2><span>PROFILE</span></div><form onSubmit={saveProfile} className="profile-form"><label>아이디<input value={user.username} disabled /></label><label>이름<input required value={profileDraft.name || user.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} /></label><label>이메일<input type="email" value={profileDraft.email || user.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} placeholder="hello@example.com" /></label><label>휴대폰<input value={profileDraft.phone || user.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} placeholder="010-0000-0000" /></label><button className="button dark-button" type="submit">정보 저장 <ArrowRight size={15} /></button></form></section></div><div className="points-note"><Sparkles size={17} /><div><strong>구매 금액의 1%를 포인트로 적립해 드려요.</strong><span>주문이 완료되면 적립 내역에 자동 반영됩니다.</span></div><span>POINTS</span></div></section>}

      {view === "admin" && isAdmin && <section className="admin-page section-wrap"><div className="admin-heading"><div><p className="eyebrow"><ShieldCheck size={14} /> ADMINISTRATION / MORROW</p><h1>운영 대시보드</h1><p>오늘의 스토어 현황을 한눈에 확인하세요.</p></div><button className="button outline-button" onClick={() => showView("shop")}><ShoppingBag size={15} /> 스토어 보기</button></div><div className="admin-tabs">{[["overview", "대시보드"], ["products", "상품 관리"], ["orders", "주문 · 배송"], ["members", "회원 관리"], ["analytics", "통계 분석"]].map(([key, label]) => <button key={key} className={adminTab === key ? "selected" : ""} onClick={() => setAdminTab(key)}>{label}</button>)}</div>
        {adminTab === "overview" && <><div className="metric-grid"><Metric label="총 매출" value={money(totalRevenue)} change="전체 누적 매출" icon={<CreditCard size={18} />} /><Metric label="신규 주문" value={`${orderCount}건`} change="전체 주문" icon={<Package size={18} />} /><Metric label="등록 상품" value={`${products.length}개`} change={`${products.filter((item) => item.stock === 0).length}개 품절`} icon={<ShoppingBag size={18} />} /><Metric label="가입 회원" value={`${memberCount}명`} change="스토어 회원" icon={<CircleUserRound size={18} />} /><Metric label="오늘 방문" value={`${visitorCount.toLocaleString()}명`} change="일별 방문자" icon={<ArrowUpRight size={18} />} /></div><div className="admin-overview-grid"><section className="admin-panel sales-panel"><div className="panel-heading"><div><span>SALES OVERVIEW</span><h2>매출 흐름</h2></div><span className="period-tag">최근 12일</span></div><div className="chart-total">{money(totalRevenue)} <span><ArrowUpRight size={14} /> 테스트 매출</span></div><div className="bar-chart">{chartValues.map((value, index) => <div className="chart-column" key={index}><div className="chart-bar" style={{ height: `${value}%` }} /><span>{serverStats?.daily[index]?.day.slice(5) ?? (index % 2 === 0 ? `${index + 1}일` : "")}</span></div>)}</div></section><section className="admin-panel latest-panel"><div className="panel-heading"><div><span>RECENT ORDERS</span><h2>최근 주문</h2></div><button onClick={() => setAdminTab("orders")}>전체 보기 <ChevronRight size={14} /></button></div>{orders.slice(0, 4).length ? orders.slice(0, 4).map((order) => <div className="latest-order" key={order.id}><div className="latest-order-icon"><BagIcon size={15} /></div><div><strong>{order.recipient}</strong><span>{order.items[0]?.name}</span></div><div><strong>{money(order.total)}</strong><span>{statusLabel[order.status]}</span></div></div>) : <p className="no-data">새로운 주문을 기다리는 중이에요.</p>}</section></div></>}
        {adminTab === "products" && (
          <section className="admin-panel table-panel">
            <div className="panel-heading"><div><span>CATALOG MANAGEMENT</span><h2>상품 관리 <small>{products.length} ITEMS</small></h2></div><button className="button dark-button compact-button" onClick={() => { setProductDraft({ category: "의류", colors: ["오프화이트"], sizes: ["FREE"], stock: 10 }); setModal("product-form"); }}><Plus size={15} /> 상품 등록</button></div>
            <div className="admin-table product-table"><div className="table-head"><span>상품</span><span>카테고리</span><span>판매가</span><span>재고</span><span>상태</span><span>관리</span></div>
              {products.map((product) => <div className="table-row" key={product.id}>
                <div className="table-product"><div style={{ backgroundImage: `url("${product.image}")` }} /><strong>{product.name}</strong></div><span>{product.category}</span><span>{money(product.price)}</span>
                <div className="stock-control"><button aria-label="재고 감소" onClick={() => void changeStock(product.id, -1)}><Minus size={13} /></button><strong>{product.stock}</strong><button aria-label="재고 증가" onClick={() => void changeStock(product.id, 1)}><Plus size={13} /></button></div>
                <span className={`stock-status ${product.stock ? "in-stock" : "out-stock"}`}>{product.stock ? "판매 중" : "품절"}</span><div className="table-actions"><button aria-label="상품 수정" onClick={() => startEdit(product)}>수정</button><button aria-label="상품 삭제" onClick={() => void deleteProduct(product.id)}>삭제</button></div>
              </div>)}
            </div>
          </section>
        )}
        {adminTab === "orders" && <section className="admin-panel table-panel"><div className="panel-heading"><div><span>FULFILLMENT</span><h2>주문 · 배송 관리</h2></div><span className="period-tag">총 {orders.length}건</span></div>{orders.length ? <div className="admin-table order-table"><div className="table-head"><span>주문 정보</span><span>수령인</span><span>결제 금액</span><span>결제 방법</span><span>배송 상태</span></div>{orders.map((order) => <div className="table-row" key={order.id}><div className="admin-order-info"><strong>#{order.id.slice(-8)}</strong><span>{new Date(order.createdAt).toLocaleDateString("ko-KR")} · {order.items.length}개 상품</span></div><span>{order.recipient}</span><strong>{money(order.total)}</strong><span>{order.paymentMethod === "card" ? "테스트 카드" : "간편 결제"}</span><select value={order.status} onChange={(event) => updateOrder(order.id, event.target.value as OrderStatus)} aria-label="배송 상태 변경"><option value="preparing">배송 준비</option><option value="shipping">배송 중</option><option value="delivered">배송 완료</option></select></div>)}</div> : <div className="table-empty"><Package size={25} /><p>아직 들어온 주문이 없습니다.</p></div>}</section>}
        {adminTab === "members" && <section className="admin-panel table-panel"><div className="panel-heading"><div><span>MEMBER RELATIONSHIP</span><h2>회원 관리 <small>{users.filter((entry) => entry.role !== "admin").length} MEMBERS</small></h2></div></div><div className="admin-table member-table"><div className="table-head"><span>회원 정보</span><span>이메일</span><span>가입 등급</span><span>포인트</span><span>회원 등급 관리</span></div>{users.filter((entry) => entry.role !== "admin").map((member) => <div className="table-row" key={member.id}><div className="member-cell"><span>{member.name.slice(0, 1)}</span><div><strong>{member.name}</strong><small>@{member.username}</small></div></div><span>{member.email || "-"}</span><span className="grade-label">{member.grade.toUpperCase()}</span><strong>{member.points.toLocaleString()} P</strong><select value={member.grade} onChange={(event) => updateGrade(member.id, event.target.value as User["grade"])} aria-label={`${member.name} 등급 변경`}><option value="welcome">WELCOME</option><option value="silver">SILVER</option><option value="gold">GOLD</option><option value="vip">VIP</option></select></div>)}</div>{users.filter((entry) => entry.role !== "admin").length === 0 && <div className="table-empty"><CircleUserRound size={24} /><p>가입한 회원이 없습니다.</p></div>}</section>}
        {adminTab === "analytics" && (
          <div className="analytics-grid">
            <section className="admin-panel analytics-main">
              <div className="panel-heading"><div><span>REVENUE & VISITORS</span><h2>일별 · 월별 분석</h2></div><span className="period-tag">최근 12일</span></div>
              <div className="analytics-stats"><div><span>오늘 매출</span><strong>{money(todayRevenue)}</strong></div><div><span>누적 매출</span><strong>{money(totalRevenue)}</strong></div><div><span>{serverStats ? "오늘 방문자" : "오늘 방문자 (추정)"}</span><strong>{visitorCount.toLocaleString()}명</strong></div></div>
              <div className="bar-chart analytics-chart">{chartValues.map((value, index) => <div className="chart-column" key={index}><div className="chart-bar" style={{ height: `${value}%` }} /><span>{dailyData[index]?.day.slice(5) ?? `${index + 1}일`}</span></div>)}</div>
              <div className="daily-summary">{dailyData.slice(-5).map((day) => <div key={day.day}><span>{day.day.slice(5)} · {serverStats ? "방문" : "추정 방문"} {day.visitors.toLocaleString()}명</span><strong>{money(day.revenue)}</strong></div>)}</div>
            </section>
            <section className="admin-panel monthly-panel">
              <div className="panel-heading"><div><span>MONTHLY SALES & VISITORS</span><h2>월별 매출 · 방문</h2></div></div>
              {monthlyData.map((month) => <div className="month-row" key={month.month}><span>{Number(month.month.slice(5))}월</span><div><i style={{ width: `${Math.max(8, Math.round(month.revenue / Math.max(totalRevenue, 1) * 100))}%` }} /></div><small>{month.visitors.toLocaleString()}명</small><strong>{money(month.revenue)}</strong></div>)}
              <p className="analytics-caption">{serverStats ? "MySQL 모드는 일별 고유 브라우저 기준으로 집계됩니다." : "데모 모드는 예시 방문자 추정치를 표시합니다."}</p>
            </section>
          </div>
        )}
      </section>}

      <footer className="site-footer"><div className="footer-top"><button className="wordmark footer-logo" onClick={() => showView("shop")}>morrow<span>·</span></button><p>좋은 물건과 느린 하루를 잇습니다.</p><button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>BACK TO TOP <ArrowUpRight size={14} /></button></div><div className="footer-bottom"><span>© 2026 MORROW MARKET. TEST STORE.</span><span>고객센터 02-1234-5678 · 평일 10:00–17:00</span><span>실제 결제가 발생하지 않는 데모 스토어입니다.</span></div></footer>

      {cartOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><aside className="drawer"><div className="drawer-header"><div><p className="eyebrow">YOUR SELECTION</p><h2>장바구니 <span>{cartCount}</span></h2></div><button className="close-button" onClick={() => setCartOpen(false)} aria-label="닫기"><X size={20} /></button></div>{cart.length ? <><div className="cart-items">{cart.map((item, index) => <article className="cart-item" key={`${item.productId}-${item.color}-${item.size}`}><div className="cart-image" style={{ backgroundImage: `url("${item.image}")` }} /><div className="cart-info"><span>{item.color} · {item.size}</span><strong>{item.name}</strong><b>{money(item.price)}</b><div className="quantity-control"><button aria-label="수량 감소" onClick={() => changeCart(index, -1)}><Minus size={12} /></button><span>{item.quantity}</span><button aria-label="수량 증가" onClick={() => changeCart(index, 1)}><Plus size={12} /></button></div></div><button className="remove-item" onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="상품 삭제"><X size={15} /></button></article>)}</div><div className="cart-bottom"><div className="shipping-note"><Truck size={16} />{cartTotal >= 50000 ? "무료 배송 혜택이 적용돼요." : `${money(50000 - cartTotal)} 더 담으면 무료 배송`}</div><div className="cart-subtotal"><span>상품 합계</span><strong>{money(cartTotal)}</strong></div><div className="cart-subtotal muted"><span>배송비</span><span>{cartTotal >= 50000 ? "무료" : money(3000)}</span></div><button className="button dark-button checkout-button" onClick={() => { setRecipient(user?.name ?? ""); setCheckoutOpen(true); }}>주문하기 <ArrowRight size={16} /></button><p className="demo-disclaimer"><ShieldCheck size={13} /> 테스트 결제 · 실제 결제가 발생하지 않습니다</p></div></> : <div className="cart-empty"><BagIcon size={27} /><p>아직 담긴 상품이 없어요.</p><button onClick={() => setCartOpen(false)}>상품 둘러보기 <ArrowRight size={14} /></button></div>}</aside></div>}

      {checkoutOpen && <div className="overlay modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}><section className="checkout-modal"><div className="modal-heading"><div><p className="eyebrow">SECURE CHECKOUT</p><h2>주문서 작성</h2></div><button className="close-button" onClick={() => setCheckoutOpen(false)} aria-label="닫기"><X size={19} /></button></div><form onSubmit={checkout}><div className="checkout-items">{cart.map((item) => <div key={`${item.productId}-${item.color}-${item.size}`}><span>{item.name} · {item.color} / {item.size} <b>× {item.quantity}</b></span><strong>{money(item.price * item.quantity)}</strong></div>)}</div><div className="checkout-total"><span>총 결제 금액</span><strong>{money(cartTotal + (cartTotal >= 50000 ? 0 : 3000))}</strong></div><div className="form-divider" /><label className="field-label">받는 분<input required value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="이름" /></label><label className="field-label">배송 주소<input required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="주소를 입력해 주세요" /></label><p className="field-label payment-label">결제 수단</p><div className="payment-options"><button type="button" className={paymentMethod === "card" ? "payment-option chosen" : "payment-option"} onClick={() => setPaymentMethod("card")}><CreditCard size={17} /><span>테스트 카드</span>{paymentMethod === "card" && <Check size={15} />}</button><button type="button" className={paymentMethod === "easy" ? "payment-option chosen" : "payment-option"} onClick={() => setPaymentMethod("easy")}><Sparkles size={17} /><span>간편 결제</span>{paymentMethod === "easy" && <Check size={15} />}</button></div><p className="fake-card-note">테스트용 가상 결제 · 카드 번호 입력 없이 승인 처리됩니다.</p><button className="button dark-button checkout-button" type="submit">{money(cartTotal + (cartTotal >= 50000 ? 0 : 3000))} 결제하기 <ArrowRight size={16} /></button></form></section></div>}

      {modal && <div className="overlay modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        {modal === "login" && <section className="auth-modal"><ModalClose onClose={() => setModal(null)} /><p className="eyebrow">WELCOME BACK</p><h2>다시 만나 반가워요.</h2><p className="modal-description">모로우의 작은 발견을 이어가 보세요.</p><form onSubmit={(event) => handleAuth(event, "login")}><label className="field-label">아이디<input name="username" required autoComplete="username" placeholder="아이디를 입력해 주세요" /></label><label className="field-label">비밀번호<input name="password" type="password" required autoComplete="current-password" placeholder="비밀번호를 입력해 주세요" /></label><button className="button dark-button checkout-button" type="submit">로그인 <ArrowRight size={16} /></button></form><div className="auth-switch">아직 회원이 아니신가요? <button onClick={() => setModal("register")}>회원가입</button></div></section>}
        {modal === "register" && <section className="auth-modal"><ModalClose onClose={() => setModal(null)} /><p className="eyebrow">JOIN MORROW</p><h2>모로우와 함께해요.</h2><p className="modal-description">회원가입하고 첫 구매 포인트를 받아보세요.</p><form onSubmit={(event) => handleAuth(event, "register")}><label className="field-label">이름<input name="name" required placeholder="이름" /></label><label className="field-label">아이디<input name="username" required minLength={3} autoComplete="username" placeholder="3자 이상" /></label><label className="field-label">이메일<input name="email" type="email" placeholder="hello@example.com" /></label><label className="field-label">비밀번호<input name="password" type="password" required minLength={4} autoComplete="new-password" placeholder="4자 이상" /></label><button className="button dark-button checkout-button" type="submit">3,000P 받고 가입하기 <ArrowRight size={16} /></button></form><div className="auth-switch">이미 회원이신가요? <button onClick={() => setModal("login")}>로그인</button></div></section>}
        {modal === "product" && selectedProduct && <section className="product-modal"><button className="close-button product-modal-close" onClick={() => setModal(null)} aria-label="닫기"><X size={19} /></button><div className="product-modal-image" style={{ backgroundImage: `url("${selectedProduct.image}")` }} /><div className="product-modal-info"><p className="eyebrow">{selectedProduct.category} / MORROW SELECT</p><h2>{selectedProduct.name}</h2><strong className="modal-price">{money(selectedProduct.price)}</strong><p className="modal-product-description">{selectedProduct.description}</p><div className="option-group"><span>COLOR <b>{selectedColor}</b></span><div className="option-list">{selectedProduct.colors.map((color) => <button key={color} className={selectedColor === color ? "option-chip active" : "option-chip"} onClick={() => setSelectedColor(color)}>{color}</button>)}</div></div><div className="option-group"><span>OPTION <b>{selectedSize}</b></span><div className="option-list">{selectedProduct.sizes.map((size) => <button key={size} className={selectedSize === size ? "option-chip active" : "option-chip"} onClick={() => setSelectedSize(size)}>{size}</button>)}</div></div><div className="detail-quantity"><span>수량</span><div className="quantity-control"><button onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus size={13} /></button><span>{quantity}</span><button onClick={() => setQuantity((current) => Math.min(selectedProduct.stock, current + 1))}><Plus size={13} /></button></div><span className="detail-stock">{selectedProduct.stock ? `재고 ${selectedProduct.stock}개` : "품절"}</span></div><button className="button dark-button checkout-button" disabled={!selectedProduct.stock} onClick={() => addToCart()}>{selectedProduct.stock ? "장바구니에 담기" : "품절"} <ArrowRight size={16} /></button><p className="delivery-detail"><Truck size={15} /> 5만원 이상 무료 배송 · 2~3일 내 출고</p></div></section>}
        {modal === "product-form" && <section className="product-form-modal"><div className="modal-heading"><div><p className="eyebrow">CATALOG MANAGEMENT</p><h2>{productDraft.id ? "상품 수정" : "새 상품 등록"}</h2></div><button className="close-button" onClick={() => setModal(null)} aria-label="닫기"><X size={19} /></button></div><form className="product-admin-form" onSubmit={saveProduct}><label className="field-label">상품명<input name="name" required defaultValue={productDraft.name} placeholder="상품명" /></label><div className="field-row"><label className="field-label">카테고리<select name="category" defaultValue={productDraft.category ?? "의류"}>{categories.filter((item) => item !== "전체").map((item) => <option key={item}>{item}</option>)}</select></label><label className="field-label">판매가<input name="price" type="number" min="0" required defaultValue={productDraft.price} /></label></div><label className="field-label">이미지 URL<input name="image" defaultValue={productDraft.image} placeholder="https://..." /></label><label className="field-label">상세 설명<textarea name="description" required defaultValue={productDraft.description} rows={3} /></label><div className="field-row"><label className="field-label">색상 (쉼표로 구분)<input name="colors" defaultValue={productDraft.colors?.join(", ")} /></label><label className="field-label">옵션 (쉼표로 구분)<input name="sizes" defaultValue={productDraft.sizes?.join(", ")} /></label></div><label className="field-label">재고 수량<input name="stock" type="number" min="0" required defaultValue={productDraft.stock} /></label><label className="checkbox-label"><input name="featured" type="checkbox" defaultChecked={productDraft.featured} /> 추천 상품으로 표시</label><button className="button dark-button checkout-button" type="submit">상품 저장 <Check size={16} /></button></form></section>}
      </div>}
      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="알림 닫기"><X size={14} /></button></div>}
    </main>
  );
}

function ModalClose({ onClose }: { onClose: () => void }) {
  return <button className="close-button auth-close" onClick={onClose} aria-label="닫기"><X size={19} /></button>;
}
function Metric({ label, value, change, icon }: { label: string; value: string; change: string; icon: React.ReactNode }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><div className="metric-change"><span><ArrowUpRight size={13} /> {change}</span><ArrowDownRight size={14} /></div></article>;
}
function Newsletter() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  return <section className="newsletter"><div><p className="eyebrow">A LITTLE NOTE FROM US</p><h2>모로우의 소식을 받아보세요.</h2><p>새로운 발견과 작은 영감을 가장 먼저 전해드릴게요.</p></div><form onSubmit={(event) => { event.preventDefault(); setJoined(true); }}><label className="sr-only" htmlFor="newsletter-email">이메일</label><input id="newsletter-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일 주소를 입력해 주세요" /><button aria-label="구독하기">{joined ? <Check size={17} /> : <ArrowRight size={17} />}</button><span>{joined ? "구독해 주셔서 고마워요." : "언제든 구독을 취소할 수 있어요."}</span></form></section>;
}
