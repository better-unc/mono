import type { NextConfig } from "next";

const workerUrl = process.env.WORKER_URL || "http://localhost:8787";

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/git/:path*",
        destination: `${workerUrl}/:path*`,
      },
      {
        source: "/api/file/:path*",
        destination: `${workerUrl}/file/:path*`,
      },
      {
        source: "/api/avatar/:path*",
        destination: `${workerUrl}/avatar/:path*`,
      },
    ];
  },
};

export default nextConfig;
