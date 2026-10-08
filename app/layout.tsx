import type { Metadata } from "next";
import "./globals.css";
import "./admin-overrides.css";

export const metadata: Metadata = {
  title: "morrow · 오늘을 위한 작은 발견",
  description: "매일의 순간을 편안하게 채우는 모로우의 셀렉션.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
