import path from "node:path";
import type { NextConfig } from "next";

// Application autonome : le site vitrine ne partage rien avec l'outil (../src).
const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
