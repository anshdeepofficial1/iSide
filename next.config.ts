import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  webpack: (config) => {
    config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false };
    return config;
  }
};
export default nextConfig;
