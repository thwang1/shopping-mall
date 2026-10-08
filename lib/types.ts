export type Category = "전체" | "의류" | "리빙" | "액세서리" | "뷰티";
export type OrderStatus = "preparing" | "shipping" | "delivered";

export type Product = {
  id: number;
  name: string;
  category: Exclude<Category, "전체">;
  price: number;
  description: string;
  image: string;
  colors: string[];
  sizes: string[];
  stock: number;
  featured?: boolean;
};

export type User = {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "admin";
  grade: "welcome" | "silver" | "gold" | "vip";
  points: number;
};

export type CartItem = {
  productId: number;
  name: string;
  image: string;
  price: number;
  color: string;
  size: string;
  quantity: number;
};

export type Order = {
  id: string;
  userId?: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  recipient: string;
  address: string;
  paymentMethod: "card" | "easy";
  items: CartItem[];
};
