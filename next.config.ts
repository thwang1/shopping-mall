import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  distDir: process.env.NODE_ENV === "development" ? ".next-development" : ".next",
};

export default nextConfig;
