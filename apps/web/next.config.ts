import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
