import type { NextConfig } from "next";

// ponytail: Vercel build must not fall back to localhost if API_PROXY_ORIGIN missing
const apiOrigin =
  process.env.API_PROXY_ORIGIN ??
  (process.env.VERCEL
    ? "https://pay3-api.vercel.app"
    : "http://localhost:4000");

// Only proxy Pay3 API routes — ignore browser-extension /api/ext/* noise.
const nextConfig: NextConfig = {
  // Phone QR hits the LAN IP; Next blocks cross-origin /_next/* without this
  allowedDevOrigins: ["10.174.201.78", "127.0.0.1"],
  transpilePackages: ["@pay3/shared", "@pay3/stellar"],
  // ponytail: WC client pulls ESM that Next needs to transpile
  serverExternalPackages: ["@walletconnect/sign-client"],
  async rewrites() {
    const routes = [
      "auth",
      "smart-account",
      "history",
      "contacts",
      "sessions",
      "policy",
      "transactions",
      "approvals",
      "audit",
      "usage",
      "mcp",
      "health",
    ];
    return routes
      .map((route) => ({
        source: `/api/${route}/:path*`,
        destination: `${apiOrigin}/${route}/:path*`,
      }))
      .concat(
        routes.map((route) => ({
          source: `/api/${route}`,
          destination: `${apiOrigin}/${route}`,
        }))
      );
  },
};

export default nextConfig;
