import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["radix-ui"],
  },
};

export default nextConfig;
